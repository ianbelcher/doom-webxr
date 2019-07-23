Doom WebVR
==========

[![Netlify Status](https://api.netlify.com/api/v1/badges/2748baae-4403-463c-998d-d9c07fa8be61/deploy-status)](https://doom-webvr.ianbelcher.me)

An experiment combining a few areas of interest:
* Reading WAD files and building a pretty specific ETL system for making the data more usable.
* Getting into A-Frame as an abstraction layer for WebVR.
* Being able to experience old-school doom in VR!

Current version can be accessed at https://doom-webvr.ianbelcher.me.

Development
-----------

Due to the nature of the build process, there is currently no development tool to watch for 
changes. You must run the build everytime you want changes to take effect.

To run the build simply run 
`npm run build`

To serve the current build, you can run the serve script such as
`npm run serve`

This will make the current build available on http://localhost:8080
