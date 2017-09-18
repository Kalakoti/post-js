import minify from "rollup-plugin-babel-minify";
 
export default {
  input: "./src/index.js",
  name: "post-js",
  output: {
    file: "./dist/post.js",
    format: "umd"
  },
  sourcemap: true,
  plugins: [
    minify({ comments: false })
  ]
};
