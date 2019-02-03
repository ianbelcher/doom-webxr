#!/bin/bash

mkdir -p assets
cd assets
../node_modules/.bin/wad-parser ../doom.wad extract ^
mogrify -format png *.tga