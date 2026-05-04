(function(){
  function openSummaryPreview({autoPrint=false}={}){
    return getSummaryRenderData().then((summaryData)=>{
      if(!summaryData){return;}
      const previewWindow=window.open("","","width=1100,height=780");
      if(!previewWindow){
        showMessage("The summary preview was blocked. Please allow pop-ups and try again.","error");
        return;
      }
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Daily Orders Summary Preview</title>
          <style>
            ${getSummaryStyles()}
            body{padding-top:72px;}
            .preview-toolbar{position:fixed;top:0;left:0;right:0;z-index:10;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;background:#142033;color:#fff;box-shadow:0 6px 18px rgba(20,32,51,.18);}
            .preview-toolbar p{margin:0;color:#fff;font-size:13px;text-align:left;}
            .preview-actions{display:flex;gap:8px;}
            .preview-actions button{min-height:36px;padding:0 14px;border:0;border-radius:999px;font-weight:700;cursor:pointer;}
            .preview-print{background:#4fca8b;color:#06111d;}
            .preview-close{background:rgba(255,255,255,.16);color:#fff;}
            @media print{body{padding-top:16px;}.preview-toolbar{display:none;}}
          </style>
        </head>
        <body>
          <div class="preview-toolbar">
            <p>Review the summary first. Use Print when everything looks correct.</p>
            <div class="preview-actions">
              <button type="button" class="preview-print" onclick="window.print()">Print</button>
              <button type="button" class="preview-close" onclick="window.close()">Close</button>
            </div>
          </div>
          ${buildSummaryMarkup(summaryData)}
          ${autoPrint?'<script>window.onload=()=>window.print()<\\/script>':""}
        </body>
        </html>
      `);
      previewWindow.document.close();
    });
  }

  window.previewSummary=openSummaryPreview;
  window.printSummary=()=>openSummaryPreview({autoPrint:false});

  document.addEventListener("DOMContentLoaded",()=>{
    const previewBtn=document.getElementById("previewSummaryBtn");
    if(previewBtn){
      previewBtn.addEventListener("click",()=>{void openSummaryPreview();});
    }
  });
})();
