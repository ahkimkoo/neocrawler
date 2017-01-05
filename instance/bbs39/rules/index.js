const list = ['article'];
const arr = list.map((item) => {
  return require(`./${item}`);
});
console.log(arr);

module.exports = arr;
