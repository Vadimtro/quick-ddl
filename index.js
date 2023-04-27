//console.log('in index.js    ', module);

/*exports.printMsg = function() {
    console.log("This is a message from the quick-ddl package");
}*/

module.exports = Object.assign(
    {},
    require('./js/ddl'),
    require('./js/tree'),
);