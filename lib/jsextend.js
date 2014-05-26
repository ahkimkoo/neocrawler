/**
 * Created by james on 13-12-5.
 * js extend
 */

/**
 * remove duplicated item from array
 * @returns {Object}
 */

if (!Array.prototype.unique) {
    Array.prototype.unique = function() {
        return this.reduce(function(p, c) {
            if (p.indexOf(c)<0)p.push(c);
            return p;
        }, []);
    };
}

/**
 * shuffle array
 */

if (!Array.prototype.shuffle) {
    Array.prototype.shuffle = function() {
        for(var j, x, i = this.length; i; j = parseInt(Math.random() * i), x = this[--i], this[i] = this[j], this[j] = x);
        return this;
    };
}

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

/**
 * detect object is empty
 * @returns {boolean}
 */
//Object.prototype.isEmpty = function() {
//    for (var prop in this) {
//        if (this.hasOwnProperty(prop)) return false;
//    }
//    return true;
//};
/**
 * detect object is empty
 * @returns {boolean}
 */
isEmpty = function(obj){
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) return false;
    }
    return true;
}

clone = function(obj) {
    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        var copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        var copy = [];
        for (var i = 0,len = obj.length; i < len; ++i) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        var copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}