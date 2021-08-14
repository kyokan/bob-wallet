// thanks to npm well-known-wallets-hns 
import https from "https";
import hdns from "hdns";

const init = hsd => hdns.setServers(['103.196.38.38', '103.196.38.39', '103.196.38.40'] );

class TLSAError extends Error {
    constructor(message = 'Invalid TLSA', code = 'EINSECURE') {
        super(message);
        this.code = code;
    }
}

const verifyTLSA = async (socket, host) => {
    const cert = socket.getPeerCertificate(false);
    const tlsa = await hdns.resolveTLSA(host, 'tcp', 443);

    try {
        const valid = hdns.verifyTLSA(tlsa[0], cert.raw);

        if (!valid) {
            throw new TLSAError();
        }
    } catch (e) {
        throw new TLSAError();
    }
};

const getAddress = (host, { dane = false, ca = !dane, token = 'HNS' } = {}) =>
    new Promise(async (resolve, reject) => {
        const options = {
            rejectUnauthorized: ca,
        };

        const req = https.get(`https://${host}/.well-known/wallets/${token}`, options, res => {
            res.setEncoding('utf8');
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', async () => {
                if (dane) {
                    try {
                        await verifyTLSA(res.socket, host);
                    } catch (e) {
                        return reject(e);
                    }
                }

                if (res.statusCode >= 400) {
                    const error = new Error(res.statusMessage);
                    error.code = res.statusCode;

                    return reject(error);
                }
                resolve(data.trim());
            });
        });

        req.on('error', reject);
        req.end();
    });

const dane = (host, token = 'HNS') => getAddress(host, { dane: true, ca: false, token });
const ca = (host, token = 'HNS') => getAddress(host, { dane: false, ca: true, token });
const caAndDane = (host, token = 'HNS') => getAddress(host, { dane: true, ca: true, token });

const daneOrCa = (host, token = 'HNS') =>
    dane(host, token).catch(error => {
        return ca(host,token);
        // if (error.code === 'EINSECURE') {
        //     return ca(host, token);
        // }
        // return Promise.reject(error);
    });

const caOrDane = (host, token = 'HNS') =>
    ca(host, token).catch(error => {
        return dane(host,token);
        // if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        //     return dane(host, token);
        // }
        // return Promise.reject(error);
    });

const Strategy = {
    DANE_OR_CA: daneOrCa,
    CA_OR_DANE: caOrDane,
    JUST_DANE: dane,
    JUST_CA: ca,
    CA_AND_DANE: caAndDane,
};

const wellKnownClient = {
    loadWellKnownAddress: async (wellknownName)=> {
        // console.log(wellknownName);
        return new Promise(async success=>{
            const address = await daneOrCa(wellknownName,"HNS").catch(error=>{
                return success({
                    ok:false,address:"",message:error.message
                })
            });
            // const caAddress = await ca(wellknownName,"HNS").catch();
            // console.log(caAddress,caAddress);
            return success({
                ok:true,address,type:""
            });
        });
    },
    isWellKnownName:(inputText)=>{
        return inputText.slice(0,1) == "@"; 
    },
    parseName:(inputText)=>{
        return wellKnownClient.isWellKnownName(inputText)? inputText.slice(1):"";
    }
};

export default wellKnownClient;
