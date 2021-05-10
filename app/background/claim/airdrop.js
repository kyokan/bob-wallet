/* Adapted from https://github.com/handshake-org/hs-airdrop/blob/master/bin/hs-airdrop */

process.env.NODE_BACKEND = 'js'

const { app } = require('electron')

const assert = require('bsert')
const fs = require('bfile')
const request = require('brq')
const Path = require('path')
const bio = require('bufio')
const pgp = require('bcrypto/lib/pgp')
const ssh = require('bcrypto/lib/ssh')
const bech32 = require('bcrypto/lib/encoding/bech32')
const blake2b = require('bcrypto/lib/blake2b')
const sha256 = require('bcrypto/lib/sha256')
const merkle = require('bcrypto/lib/mrkl')
const hkdf = require('bcrypto/lib/hkdf')
const AirdropKey = require('hs-airdrop/lib/key')
const AirdropProof = require('hs-airdrop/lib/proof')
const tree = require('hs-airdrop/etc/tree.json')
const faucet = require('hs-airdrop/etc/faucet.json')
const { PGPMessage, SecretKey } = pgp
const { SSHPrivateKey } = ssh

const { PUBLIC_KEY, PRIVATE_KEY } = pgp.packetTypes

/*
 * Constants
 */

let BUILD_DIR = Path.resolve(app.getPath('temp'), '.hs-tree-data')
const NONCE_DIR = Path.resolve(BUILD_DIR, 'nonces')
const GITHUB_URL = 'https://github.com/handshake-org/hs-tree-data/raw/master'

const {
  checksum: TREE_CHECKSUM,
  leaves: TREE_LEAVES,
  subleaves: SUBTREE_LEAVES,
  checksums: TREE_CHECKSUMS,
} = tree

const {
  checksum: FAUCET_CHECKSUM,
  leaves: FAUCET_LEAVES,
  proofChecksum: PROOF_CHECKSUM,
} = faucet

/*
 * Airdrop
 */

async function readFile(...path) {
  if (!(await fs.exists(BUILD_DIR))) await fs.mkdir(BUILD_DIR, 0o755)
  if (!(await fs.exists(NONCE_DIR))) await fs.mkdir(NONCE_DIR, 0o755)

  const checksum = Buffer.from(path.pop(), 'hex')
  const file = Path.resolve(BUILD_DIR, ...path)
  const base = Path.basename(file)

  if (!(await fs.exists(file))) {
    const url = `${GITHUB_URL}/${path.join('/')}`

    console.log('Downloading: %s...', url, 'to', NONCE_DIR)

    const req = await request({
      url,
      limit: 100 << 20,
      timeout: 10 * 60 * 1000,
    })

    const raw = req.buffer()

    if (!sha256.digest(raw).equals(checksum))
      throw new Error(`Invalid checksum: ${base}`)

    await fs.writeFile(file, raw)

    return raw
  }

  const raw = await fs.readFile(file)

  if (!sha256.digest(raw).equals(checksum))
    throw new Error(`Invalid checksum: ${base}`)

  return raw
}

async function readTreeFile() {
  updateRedeemStatus(60, 'Downloading tree...')
  return readFile('tree.bin', TREE_CHECKSUM)
}

async function readFaucetFile() {
  updateRedeemStatus(30, 'Downloading faucet file...')
  return readFile('faucet.bin', FAUCET_CHECKSUM)
}

async function readNonceFile(index) {
  assert((index & 0xff) === index)
  updateRedeemStatus(20, 'Downloading nonce file...')
  return readFile('nonces', `${pad(index)}.bin`, TREE_CHECKSUMS[index])
}

async function readProofFile() {
  const raw = await readFile('proof.json', PROOF_CHECKSUM)
  return JSON.parse(raw.toString('utf8'))
}

async function readLeaves() {
  const data = await readTreeFile()
  updateRedeemStatus(70, 'Loading tree...')
  const br = bio.read(data)
  const totalLeaves = br.readU32()
  const leaves = []

  for (let i = 0; i < totalLeaves; i++) {
    const hashes = []

    for (let j = 0; j < SUBTREE_LEAVES; j++) {
      const hash = br.readBytes(32, true)
      hashes.push(hash)
    }

    leaves.push(hashes)
  }

  assert.strictEqual(br.left(), 0)
  assert.strictEqual(totalLeaves, TREE_LEAVES)

  return leaves
}

function flattenLeaves(leaves) {
  assert(Array.isArray(leaves))

  const out = []

  for (const hashes of leaves) {
    const root = merkle.createRoot(blake2b, hashes)
    out.push(root)
  }

  return out
}

function findLeaf(leaves, target) {
  assert(Array.isArray(leaves))
  assert(Buffer.isBuffer(target))

  for (let i = 0; i < leaves.length; i++) {
    const hashes = leaves[i]

    // Could do a binary search here.
    for (let j = 0; j < hashes.length; j++) {
      const hash = hashes[j]

      if (hash.equals(target)) return [i, j]
    }
  }

  return [-1, -1]
}

async function readFaucetLeaves() {
  const data = await readFaucetFile()
  updateRedeemStatus(45, 'Loading faucet file...')
  const br = bio.read(data)
  const totalLeaves = br.readU32()
  const leaves = []

  for (let i = 0; i < totalLeaves; i++) {
    const hash = br.readBytes(32)
    leaves.push(hash)
  }

  assert.strictEqual(br.left(), 0)
  assert.strictEqual(totalLeaves, FAUCET_LEAVES)

  return leaves
}

function findFaucetLeaf(leaves, target) {
  assert(Array.isArray(leaves))
  assert(Buffer.isBuffer(target))

  updateRedeemStatus(60, 'Finding faucet leaf...')

  // Could do a binary search here.
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i]

    if (leaf.equals(target)) return i
  }

  return -1
}

async function findNonces(key, priv) {
  assert(key instanceof AirdropKey)
  assert(priv instanceof SecretKey || priv instanceof SSHPrivateKey)

  const bucket = key.bucket()
  const data = await readNonceFile(bucket)
  const br = bio.read(data)
  const out = []

  updateRedeemStatus(30, 'Finding nonce in file. May take time.')

  while (br.left()) {
    const ct = br.readBytes(br.readU16(), true)

    try {
      out.push(key.decrypt(ct, priv))
    } catch (e) {
      continue
    }
  }

  if (out.length === 0) {
    const err = new Error()
    err.name = 'NonceError'
    err.message = `Could not find nonce in bucket ${bucket}.`
    throw err
  }

  return out
}

async function createAddrProofs(options) {
  assert(options != null)
  assert(Array.isArray(options.entries))

  const leaves = await readFaucetLeaves()
  const proofs = []

  for (const { pub } of options.entries) {
    const index = findFaucetLeaf(leaves, pub.hash())

    if (index === -1) throw new Error('Could not find leaf.')

    updateRedeemStatus(85, `Creating proof from leaf ${index}...`)
    console.log('Creating proof from leaf %d...', index)

    const proof = merkle.createBranch(blake2b, index, leaves)
    const p = new AirdropProof()

    p.index = index
    p.proof = proof
    p.key = pub.encode()
    p.version = pub.version
    p.address = pub.address
    p.fee = pub.sponsor ? 500e6 : 100e6

    assert(p.fee <= p.getValue())

    if (!p.verify()) throw new Error('Proof failed verification.')

    proofs.push(p)
  }

  return proofs
}

async function createKeyProofs(options) {
  assert(options != null && options.key != null)
  assert(options.key.pub instanceof AirdropKey)

  const { pub, priv } = options.key

  const items = await findNonces(pub, priv)

  updateRedeemStatus(40, 'Found nonce! Rebuilding tree...')
  console.log('Found nonce!')
  console.log('Rebuilding tree...')

  const leaves = await readLeaves()
  const tree = flattenLeaves(leaves)
  const proofs = []

  for (const [i, [nonce, seed]] of items.entries()) {
    const key = pub.clone()

    if (options.bare) key.applyNonce(nonce)
    else key.applyTweak(nonce)

    console.log('Finding merkle leaf for reward %d...', i)
    updateRedeemStatus(80, 'Finding merkle leaf for reward ' + i)

    const [index, subindex] = findLeaf(leaves, key.hash())

    if (index === -1) throw new Error('Could not find leaf.')

    const subtree = leaves[index]

    diffSubtree(key, nonce, seed, subtree)

    console.log('Creating proof from leaf %d:%d...', index, subindex)
    updateRedeemStatus(80, 'Creating proof from leaf ' + index + ':' + subindex)

    const subproof = merkle.createBranch(blake2b, subindex, subtree)
    const proof = merkle.createBranch(blake2b, index, tree)
    const p = new AirdropProof()

    p.index = index
    p.proof = proof
    p.subindex = subindex
    p.subproof = subproof
    p.key = key.encode()
    p.version = options.version
    p.address = options.hash
    p.fee = options.fee

    if (p.fee > p.getValue()) throw new Error('Fee exceeds value!')

    console.log('Signing proof %d:%d...', index, subindex)
    updateRedeemStatus(80, 'Signing proof ' + index + ':' + subindex)

    p.sign(key, priv)

    if (!p.verify()) throw new Error('Proof failed verification.')

    proofs.push(p)
  }

  return proofs
}

function deriveSubleaves(seed) {
  const len = SUBTREE_LEAVES * 32
  const prk = hkdf.extract(sha256, seed)
  const raw = hkdf.expand(sha256, prk, null, len)
  const hashes = []

  for (let i = 0; i < len; i += 32) hashes.push(raw.slice(i, i + 32))

  return hashes
}

function diffSubtree(key, nonce, seed, subtree) {
  assert(key instanceof AirdropKey)
  assert(Buffer.isBuffer(seed))
  assert(Array.isArray(subtree))

  // Derive subtree leaves.
  const hashes = deriveSubleaves(seed)

  // Filter out synthetic hashes.
  // This basically proves that the generation
  // script did not do anything malicious. It
  // also informs the user that other keys are
  // available to use.
  const keyHashes = []

  for (const hash of subtree) {
    let synthetic = false

    for (const h of hashes) {
      if (h.equals(hash)) {
        synthetic = true
        break
      }
    }

    if (!synthetic) keyHashes.push(hash)
  }

  console.log('')
  console.log('%d keys found in your subtree:', keyHashes.length)

  const keyHash = key.hash()

  for (const hash of keyHashes) {
    if (keyHash.equals(hash))
      console.log('  %s (current)', hash.toString('hex'))
    else console.log('  %s', hash.toString('hex'))
  }

  console.log('')
}

/*
 * CLI
 */

async function parsePGP(msg, keyID, passphrase) {
  assert(msg instanceof PGPMessage)
  assert(Buffer.isBuffer(keyID))

  let priv = null
  let pub = null

  for (const pkt of msg.packets) {
    if (pkt.type === PRIVATE_KEY) {
      const key = pkt.body

      if (key.key.matches(keyID)) {
        priv = key
        pub = key.key
        continue
      }

      continue
    }

    if (pkt.type === PUBLIC_KEY) {
      const key = pkt.body

      if (key.matches(keyID)) {
        pub = key
        continue
      }

      continue
    }
  }

  if (!priv && !pub) throw new Error(`Could not find key for ID: ${keyID}.`)

  if (!priv) {
    return {
      type: 'pgp',
      pub: AirdropKey.fromPGP(pub),
      priv: null,
    }
  }

  // let passphrase = null

  if (priv.params.encrypted) {
    console.log(`I found key ${pgp.encodeID(keyID)}, but it's encrypted.`)

    // passphrase = await readPassphrase()
  }

  return {
    type: 'pgp',
    pub: AirdropKey.fromPGP(priv.key),
    priv: priv.secret(passphrase || null),
  }
}

async function readKey({ file, keyID, keyType, passphrase, isFile = true }) {
  console.log('readKey:', keyID, keyType, isFile)
  assert(typeof file === 'string')
  assert(keyID == null || Buffer.isBuffer(keyID))

  let data, ext
  if (isFile) {
    data = await fs.readFile(file)
    ext = Path.extname(file)
  } else {
    data = file
    if (keyType === 'pgp') ext = '.asc'
    else ext = '.' + keyType
  }

  switch (ext) {
    case '.asc': {
      assert(keyID)
      const str = data.toString('utf8')
      const msg = PGPMessage.fromString(str)
      return parsePGP(msg, keyID, passphrase)
    }

    case '.pgp':
    case '.gpg': {
      assert(keyID)
      const msg = PGPMessage.decode(data)
      return parsePGP(msg, keyID)
    }

    default: {
      const str = data.toString('utf8')
      const key = SSHPrivateKey.fromString(str, passphrase)
      return {
        type: 'ssh',
        pub: AirdropKey.fromSSH(key),
        priv: key,
      }
    }
  }
}

async function readEntries(addr) {
  const [, target] = parseAddress(addr)
  const items = await readProofFile()
  const out = []

  for (const [address, value, sponsor] of items) {
    const [, hash] = parseAddress(address)

    if (!hash.equals(target)) continue

    out.push({
      type: 'addr',
      pub: AirdropKey.fromAddress(addr, value, sponsor),
      priv: null,
    })
  }

  if (out.length === 0)
    throw new Error('Address is not a faucet or sponsor address.')

  return out
}

/*
 * Helpers
 */

function pad(index) {
  assert((index & 0xff) === index)

  let str = index.toString(10)

  while (str.length < 3) str = '0' + str

  return str
}

function parseAddress(addr) {
  const [hrp, version, hash] = bech32.decode(addr)

  if (hrp !== 'hs' && hrp !== 'ts' && hrp !== 'rs')
    throw new Error('Invalid address HRP.')

  if (version !== 0) throw new Error('Invalid address version.')

  if (hash.length !== 20 && hash.length !== 32)
    throw new Error('Invalid address.')

  return [version, hash]
}

/*
 * Execute
 */

var updateRedeemStatus;
async function redeemStart({ keyType, privKey, keyId, hnsAddr, passphrase }, updateStatus) {
  console.log('Redeeming', keyType, keyId, hnsAddr)

  updateRedeemStatus = (percent, status) => {
    if (percent === -1)
      throw new Error(status)

    updateStatus({status, percent})
  }

  try {
    updateRedeemStatus(0, 'Parsing key.')

    const options = {
      __proto__: null,
      files: [],
      bare: true,
      type: keyType,
      key: null,
      entries: [],
      addr: hnsAddr,
      fee: 1e5,
      version: 0,
      hash: null,
    }

    switch (keyType) {
      case 'pgp': {
        // const [file, id, addr] = options.files
        const keyID = pgp.decodeID(keyId)
        try {
          options.key = await readKey({
            file: privKey,
            keyType: 'pgp',
            passphrase,
            keyID,
            isFile: false,
          })
          options.addr = hnsAddr
        } catch (error) {
          console.error(error.stack)
          throw new Error('Invalid Private Key.')
        }
        break
      }

      case 'ssh': {
        try {
          options.key = await readKey({
            file: privKey,
            keyType: 'ssh',
            passphrase,
            isFile: false,
          })
        } catch (error) {
          console.error(error.stack)
          throw new Error('Invalid Private Key.')
        }
        break
      }

      case 'addr':
      case 'faucet': {
        // const [addr] = options.files
        options.entries = await readEntries(hnsAddr)
        options.addr = hnsAddr
        break
      }

      default: {
        throw new assert.AssertionError('Invalid key type.')
      }
    }

    ;[options.version, options.hash] = parseAddress(options.addr)

    updateRedeemStatus(10, 'Attempting to create proof.')

    const proofs =
      options.type !== 'addr' && options.type !== 'faucet'
        ? await createKeyProofs(options)
        : await createAddrProofs(options)

    console.log(proofs)
    updateRedeemStatus(100, 'Done!')

    let proofData = []

    // Printing proofs to console
    for (const [i, proof] of proofs.entries()) {
      console.log('\n', i)
      console.log('JSON:')
      console.log(JSON.stringify(proof.toJSON(), null, 2))
      console.log('')
      proofData.push({
        type: proof.toJSON().key.type,
        b64encoded: proof.toBase64(),
      })
      console.log('Base64 (pass this to $ hsd-rpc sendrawairdrop):')
      console.log(proofData[proofData.length - 1].b64encoded)
    }
    return proofData
  } catch (error) {
    console.error(error)
    // If not found, then it's not really an error. Send back empty proof.
    if (error.name == 'NonceError') {
      updateRedeemStatus(100, error)
    } else {
      updateRedeemStatus(-1, error)
    }
  }
}

export { redeemStart }
