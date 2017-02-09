import fm from './app/app.js';

let requireContext = require.context("./app", true, /\.(css|js)$/);
requireContext.keys().map(requireContext);

import './build/icons.js';

export default fm;
