/**
 * Created by james on 13-12-5.
 * js extend
 */

Object.prototype.isEmpty = function() {
    for (var prop in this) {
        if (this.hasOwnProperty(prop)) return false;
    }
    return true;
};

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

String.prototype.trim= function(){
    return this.replace(/(^\s*)|(\s*$)/g, "");
}

String.prototype.startsWith = function(suffix) {
    return this.indexOf(suffix,0) !== -1;
};
