##
# Ledger fix for Arch Linux users.
# execute this on the root of bob-wallet directory.
#
# 2023 © Miguel Gargallo and Rithvik Vibhu
#
# Install the rules for the Ledger and npm install the hsd-ledger package on bob-wallet by Kyokan.
#
# First run: chmod +x ./ledger-fix.sh
# then run: ./ledger-fix.sh
##
#!/usr/bin/env bash
echo "#######################################################"
echo "# THIS COMMAND INSTALL INSTRUCTIONS ON TO YOUR SYSTEM #"
echo "# IT SHOULD ONLY BE USED IN DEVELOPMENT!              #"
echo "#######################################################"
wget -q -O - https://raw.githubusercontent.com/LedgerHQ/udev-rules/master/add_udev_rules.sh | sudo bash && npm install github:handshake-org/hsd-ledger#v2.0.2
