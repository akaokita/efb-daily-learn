(function(){
  function assemble(){
    var parts=window.__COCKPIT_B64_PARTS||[];
    if(!parts.length) return null;
    for(var i=0;i<parts.length;i++){ if(!parts[i]) return null; }
    return "data:image/jpeg;base64,"+parts.join("");
  }
  window.COCKPIT_IMAGE_DATA_URL=assemble();
})();
