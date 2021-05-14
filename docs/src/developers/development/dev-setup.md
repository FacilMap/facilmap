# Dev setup

1. Run `yarn install` to install the dependencies
2. Run `yarn build` to build the JS bundles
3. Copy `config.env.example` to `config.env` and adjust the settings
4. Run `yarn server` inside the `server` directory

For developing the frontend/client, FacilMap server can integrate webpack-dev-server. This server will automatically
recompile the frontend files when a file changes, and even delay reloads until the compilation has finished. To run
the dev server, run `yarn dev-server` instead of `yarn server` in the `server` directory. Note that changes in the `client`, `types` or `leaflet` directory still have to be built using `yarn build` in the respective directories for the dev-server to notice them.

While developing the server, run `yarn ts-server`, which will start the server straight from the TypeScript files (which makes it obsolete to run `yarn build` every time before restarting the server).

To enable debug output of various components, additionally prepend the command by `DEBUG=*`. See the documentation of
[debug](https://github.com/visionmedia/debug). To only enable the debug logging of SQL queries, use `DEBUG=sql`.