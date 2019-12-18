#!/bin/bash

if [ -z ${HOST:-} ]
  then
    echo "HOST variable not set. You need to supply a HOST for the certificate."
    exit 1
fi

mkdir -p certs

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout server.key -out server.crt -subj "/CN=${HOST}/O=${HOST}"