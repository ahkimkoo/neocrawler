/**
 * Created by James on 14-2-13.
 * jquery, jsoneditor required
 */
var jsonEditorConstructor = function(jsonElement,inputElement){
    var objectValue = $.parseJSON(inputElement.val());
    if(!jsonElement.hasClass("json-editor")){
        jsonElement.addClass("json-editor");
    }
    if(!inputElement.hasClass("json-input")){
        inputElement.addClass("json-input");
    }
    inputElement.change(function(){
        var  val = inputElement.val();
        if (val) {
            try { objectValue = JSON.parse(val); }
            catch (e) { alert('Error in parsing json. ' + e); }
        } else {
            objectValue = {};
        }
        jsonElement.jsonEditor(objectValue, { change: function(){
            inputElement.val(JSON.stringify(objectValue));
        }});
    });
    jsonElement.jsonEditor(objectValue, { change: function(){
        inputElement.val(JSON.stringify(objectValue));
    }});
}