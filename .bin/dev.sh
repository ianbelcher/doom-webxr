#!/usr/bin/env sh

docker build --tag=doom . 
docker rm -fv doom
docker run \
-it \
--name doom \
-v $(pwd)/container:/container \
-v $(pwd)/web:/web \
doom \
/bin/bash
