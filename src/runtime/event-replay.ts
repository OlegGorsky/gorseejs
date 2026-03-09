// Event Replay -- captures user interactions before hydration completes
// Inspired by Angular's JSAction / Google Wiz
//
// This generates a small inline <script> (~400 bytes minified)
// that should be placed before any app content in the HTML.

export const EVENT_REPLAY_SCRIPT = `<script data-g-event-replay>
(function(){
  var Q=[];
  var E=["click","input","change","submit","keydown","keyup","focusin","focusout"];
  function capture(e){
    Q.push({type:e.type,target:e.target,timeStamp:e.timeStamp,
      detail:e.type==="input"?e.target.value:undefined,
      key:e.key||undefined});
    if(e.type==="submit")e.preventDefault();
  }
  E.forEach(function(t){document.addEventListener(t,capture,{capture:true})});
  window.__gorsee_events={
    queue:Q,
    stop:function(){E.forEach(function(t){document.removeEventListener(t,capture,{capture:true})})},
    replay:function(root){
      this.stop();
      Q.forEach(function(ev){
        if(ev.target&&root.contains(ev.target)){
          ev.target.dispatchEvent(new Event(ev.type,{bubbles:true}));
        }
      });
      Q.length=0;
    }
  };
})();
</script>`

interface GorseeEventReplay {
  queue: unknown[]
  stop(): void
  replay(root: Element): void
}

function getEventReplay(): GorseeEventReplay | undefined {
  return (globalThis as Record<string, unknown>).__gorsee_events as GorseeEventReplay | undefined
}

export function replayEvents(root: Element): void {
  getEventReplay()?.replay(root)
}

export function stopEventCapture(): void {
  getEventReplay()?.stop()
}
