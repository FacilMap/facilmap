# Documentation

The FacilMap documentation is built using [VuePress](https://vuepress.vuejs.org/) from the Markdown files in the [docs](https://github.com/FacilMap/facilmap/tree/master/docs) directory. The [facilmap/facilmap-docs](https://hub.docker.com/r/facilmap/facilmap-docs) Docker image is automatically generated with the latest docs.

## Dev setup

If you want to make some changes to the documentation, first install the necessary dependencies by running `yarn install` in the `docs` directory, and then run `yarn dev-server`. This will start a webserver on http://localhost:8080/ that will show the documentation. Whenever you make changes to the documentation files, the browser will automatically refresh the page and show the latest version.

## Build

Before building the documentation, run `yarn run check` to check that all links in the markdown point to a valid destination.

To build the documentation, run `yarn run build`. This will create static HTML files in `dist` that can be served by a simple HTTP server.

## Embed videos

In the documentation, more complex user interactions are illustrated by screencasts. Since the UI looks somewhat different on big screens than on small screens and works somewhat differently on touch devices than on mouse devices, two recordings of the same interaction are shown next to each other, one representing a desktop computer and one representing a smartphone.

The desktop video should have dimensions of 1024×768 pixels and the smartphone video 320×480 pixels. Both should be recorded with 15 fps and in MP4 format with a sensible framerate (the FFMPEG default bitrate has been used so far, using `ffmpeg -i recording_raw.mp4 recording.mp4`).

The existing recordings were created using [SimpleScreenRecorder](https://www.maartenbaert.be/simplescreenrecorder/). Chromium shows the dimensions of the viewport when the dev tools are open, which makes it easier to adjust it to the right size. For the mobile recordings, Chromium was configured to simulate an iPhone 4.

To embed a video into the documentation, the custom `Screencast` component can be used in Markdown:
```jsx
<Screencast :desktop="require('./recording.mp4')" :mobile="require('./recording-mobile.mp4')"></Screencast>
```

## Embed screenshots

Screenshots should be saved as PNG, with a size of 1024×768 pixels for desktop and 320×480 pixels for mobile. To show the desktop and mobile screenshots next to each other, use the custom `Screenshot` component in Markdown:
```jsx
<Screenshot :desktop="require('./screenshot.png')" :mobile="require('./screenshot-mobile.png')"></Screenshot>
```

## Docker image

To build the docker image, run `docker build -t facilmap-docs .`. To run it, simply run `docker run -d facilmap-docs`. The docker container will expose a HTTP server on port 80.