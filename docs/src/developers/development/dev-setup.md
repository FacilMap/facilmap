# Dev setup

1. Run `yarn install` to install the dependencies
2. Copy `config.env.example` to `config.env` and adjust the settings
3. Run `yarn dev-server` inside the `server` directory

This will start the FacilMap server with an integrated Vite dev server that takes care of transpiling the frontend on the fly and also integrating hot module reloading, which can apply Vue component changes without a page reload.

While developing the server, you can also run `yarn server` instead, which will start the server straight from the TypeScript files (which makes it obsolete to run `yarn build` every time before restarting the server) but without transpiling the frontend each time, which makes restarts faster.

To enable debug output of various components, additionally prepend the command by `DEBUG=*`. See the documentation of
[debug](https://github.com/visionmedia/debug). To only enable the debug logging of SQL queries, use `DEBUG=sql`.