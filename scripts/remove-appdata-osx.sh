#!/usr/bin/env bash

echo "#######################################################"
echo "# THIS COMMAND WILL ERASE YOUR BOB APP DATA DIRECTORY #"
echo "# IT SHOULD ONLY BE USED IN DEVELOPMENT!              #"
echo "#######################################################"

read -p "Are you sure? " -n 1 -r
echo    # (optional) move to a new line
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
  echo "Aborting."
  exit 1
fi

echo "Erasing app directory..."
rm -rf "$HOME/Library/Application Support/Bob"
echo "Done."
