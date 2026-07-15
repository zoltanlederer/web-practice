function add(a, b){
    return a + b;
}

function multiply(a, b){
    return a * b;
}

module.exports = {add, multiply}
// is shorthand for:
module.exports = {add: add, multiply: multiply};