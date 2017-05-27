import fm from './app/app.js';

let requireContext = require.context("./app", true, /\.(s?css|js)$/);
requireContext.keys().map(requireContext);

import './build/icons.js';

export default fm;
