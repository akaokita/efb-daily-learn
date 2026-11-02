(function(){
  function assemble(){
    var parts=window.__COCKPIT_B64_PARTS||[];
    if(parts.length<3 || parts.some(function(p){return !p;})) return null;
    return "data:image/jpeg;base64,"+parts.join("");
  }
  window.COCKPIT_IMAGE_DATA_URL=assemble();
})();
