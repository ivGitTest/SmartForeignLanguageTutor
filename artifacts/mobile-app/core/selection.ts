export function sentenceForSelection(text: string, start: number, end: number) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) return null;
  const expression = text.slice(start, end).trim();
  if (!expression || expression.length > 500) return null;
  let left = start;
  let right = end;
  while (left > 0 && !/[.!?\n]/.test(text[left - 1])) left--;
  while (right < text.length && !/[.!?\n]/.test(text[right - 1])) right++;
  const sentence = text.slice(left, right).trim();
  return { expression, sentence };
}
export function transcriptDocument(text: string) {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"><style>
html,body{margin:0;background:transparent;color:#243b39;font:17px/1.65 sans-serif;white-space:pre-wrap;overflow-wrap:anywhere}#text{user-select:text;-webkit-user-select:text}::selection{background:#dcebe1}
</style></head><body><div id="text">${escaped}</div><script>
function send(data){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(data));else parent.postMessage(data,'*')}
function height(){send({type:'height',height:document.body.scrollHeight})}
function selected(){const s=window.getSelection();if(!s||s.isCollapsed||!s.rangeCount)return;const r=s.getRangeAt(0),el=document.getElementById('text');if(!el.contains(r.startContainer)||!el.contains(r.endContainer))return;const pre=r.cloneRange();pre.selectNodeContents(el);pre.setEnd(r.startContainer,r.startOffset);const start=pre.toString().length;send({type:'selection',start:start,end:start+r.toString().length})}
document.addEventListener('mouseup',selected);document.addEventListener('touchend',function(){setTimeout(selected,250)});
document.addEventListener('selectionchange',function(){clearTimeout(window.selectionTimer);window.selectionTimer=setTimeout(selected,600)});
new ResizeObserver(height).observe(document.body);height();
</script></body></html>`;
}
export type SelectableProps = { text: string; onSelect: (expression: string, sentence: string) => void };
