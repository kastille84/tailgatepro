# Folder Structure

## Root

References the files at the root of the project.

- server.js - is the entry point to the application. It runs the node/express.js server. This file handles requests from the front end and performs specific tasks like doing crud operations in supabase, stripe.js specific operations, runs pythons commands for pdf creation, etc.

## Client

This folder '/client' is to handle the UI aka front end.
| folder | description |
| ---- | ---------- |
| ./src/assets/ | TBD |
| ./src/constants/ | holds all the contant variables used throughout the app |
| ./src/context/ | holds all the react context files i.e GlobalContext, StripeContext, etc. |
| ./src/data/ | holds any static data used in the app. i.e. list of dropdown items for select inputs |
| ./src/features/ | holds all the features of the application. i.e. authentication, account, qr-code, text-to-speech |
| ./src/hooks/ | holds all the react hooks that are used throughout the app. i.e usePWAInstallation, useStripe |
| ./src/interfaces/ | holds all the interface declarations the specific and custom data types i.e AuthUser, Geo, Plan, PDFResponse, PDFCreate |
| ./src/pages/ | holds all the page components. i.e. Dashboard, Landing, Pricing |
| ./src/partials/ | holds components that return partial contents for modals |
| ./src/services/ | holds all the functions that make api calls to the backend nodejs/expressjs server. i.e. apiAuth, apiUser, apiStripe, apiPlans |
| ./src/styles/ | holds all the files related to styling CSS |
| ./src/ui/-comps | holds all the reusable, independent components that can be used to make up parts of the pages components. i.e. button, Footer, Input |
| ./src/utils/| holds all the utility functions that are used by components. i.e. GeneralUtils, ServiceUtils|

## Server

This folder './server' is to handle the server calls sent from the front end ui to the back end.
| folder | description |
| ---- | ---------- |
| server/controllers | These controller files handle making the calls to update supabase, stripe, authentication, emails, etc |
| server/middlewares | These files handle validating the data coming from the front end so that it can be transfered to the backend |
| server/routes | These files handle connecting the correct route & HTTP Method to the correct controller. i.e. auth, email, stripe |
| server/utility | holds all the utility functions that are used by controllers |
