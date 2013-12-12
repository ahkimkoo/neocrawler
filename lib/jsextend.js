/**
 * Created by james on 13-12-5.
 * js extend
 */

/**
 * detect object is empty
 * @returns {boolean}
 */
Object.prototype.isEmpty = function() {
    for (var prop in this) {
        if (this.hasOwnProperty(prop)) return false;
    }
    return true;
};
/**
 * remove duplicated item from array
 * @returns {Object}
 */
Array.prototype.unique = function() {
    return this.reduce(function(p, c) {
        if (p.indexOf(c)<0)p.push(c);
        return p;
    }, []);
};
/**
 * detect whether string end with some special character
 * @param suffix
 * @returns {boolean}
 */
String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};
/**
 * detect whether string start with some special character
 * @param suffix
 * @returns {boolean}
 */
String.prototype.startsWith = function(suffix) {
    return this.indexOf(suffix,0) !== -1;
};
/**
 * remove blank around the string
 * @returns {string}
 */
String.prototype.trim= function(){
    return this.replace(/(^\s*)|(\s*$)/g, "");
}


