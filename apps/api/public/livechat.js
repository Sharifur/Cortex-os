var Ws=Object.defineProperty,Ys=Object.defineProperties;var Js=Object.getOwnPropertyDescriptors;var ct=Object.getOwnPropertySymbols;var Xs=Object.prototype.hasOwnProperty,Qs=Object.prototype.propertyIsEnumerable;var lt=(T,w,_)=>w in T?Ws(T,w,{enumerable:!0,configurable:!0,writable:!0,value:_}):T[w]=_,ce=(T,w)=>{for(var _ in w||(w={}))Xs.call(w,_)&&lt(T,_,w[_]);if(ct)for(var _ of ct(w))Qs.call(w,_)&&lt(T,_,w[_]);return T},Be=(T,w)=>Ys(T,Js(w));(function(){"use strict";async function T(s){try{const e=await fetch(`${s.apiBase}/livechat/config?siteKey=${encodeURIComponent(s.siteKey)}`,{method:"GET",credentials:"omit"});return e.ok?await e.json():null}catch(e){return null}}async function w(s,e,t){const n=new FormData;n.append("siteKey",s.siteKey),n.append("visitorId",s.visitorId),n.append("sessionId",e),n.append("file",t,t.name);const i=await fetch(`${s.apiBase}/livechat/upload`,{method:"POST",body:n,credentials:"omit"});if(!i.ok){const r=await i.text().catch(()=>"");throw new Error(`${i.status} ${i.statusText}${r?` — ${r}`:""}`)}return i.json()}async function _(s,e){const t=await fetch(s,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e),credentials:"omit"});if(!t.ok){const n=await t.text().catch(()=>"");throw new Error(`${t.status} ${t.statusText}${n?` — ${n}`:""}`)}return t.json()}function ht(s,e){return _(`${s.apiBase}/livechat/track/pageview`,ce({siteKey:s.siteKey,visitorId:s.visitorId},e))}function dt(s,e){return _(`${s.apiBase}/livechat/track/heartbeat`,{siteKey:s.siteKey,visitorId:s.visitorId,url:e.url,title:e.title}).catch(()=>{})}function Re(s,e){const t=`${s.apiBase}/livechat/track/leave`,n=JSON.stringify({siteKey:s.siteKey,visitorId:s.visitorId,pageviewId:e});if(navigator.sendBeacon){const i=new Blob([n],{type:"application/json"});navigator.sendBeacon(t,i);return}fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:n,keepalive:!0}).catch(()=>{})}function pt(s,e,t,n){return _(`${s.apiBase}/livechat/message`,{siteKey:s.siteKey,visitorId:s.visitorId,content:e,attachmentIds:t&&t.length?t:void 0,meta:n})}function ut(s,e){return _(`${s.apiBase}/livechat/identify`,{siteKey:s.siteKey,visitorId:s.visitorId,email:e.email,name:e.name})}const R=Object.create(null);R.open="0",R.close="1",R.ping="2",R.pong="3",R.message="4",R.upgrade="5",R.noop="6";const J=Object.create(null);Object.keys(R).forEach(s=>{J[R[s]]=s});const le={type:"error",data:"parser error"},Le=typeof Blob=="function"||typeof Blob!="undefined"&&Object.prototype.toString.call(Blob)==="[object BlobConstructor]",Ie=typeof ArrayBuffer=="function",Ce=s=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(s):s&&s.buffer instanceof ArrayBuffer,he=({type:s,data:e},t,n)=>Le&&e instanceof Blob?t?n(e):Ne(e,n):Ie&&(e instanceof ArrayBuffer||Ce(e))?t?n(e):Ne(new Blob([e]),n):n(R[s]+(e||"")),Ne=(s,e)=>{const t=new FileReader;return t.onload=function(){const n=t.result.split(",")[1];e("b"+(n||""))},t.readAsDataURL(s)};function qe(s){return s instanceof Uint8Array?s:s instanceof ArrayBuffer?new Uint8Array(s):new Uint8Array(s.buffer,s.byteOffset,s.byteLength)}let de;function ft(s,e){if(Le&&s.data instanceof Blob)return s.data.arrayBuffer().then(qe).then(e);if(Ie&&(s.data instanceof ArrayBuffer||Ce(s.data)))return e(qe(s.data));he(s,!1,t=>{de||(de=new TextEncoder),e(de.encode(t))})}const $e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",H=typeof Uint8Array=="undefined"?[]:new Uint8Array(256);for(let s=0;s<$e.length;s++)H[$e.charCodeAt(s)]=s;const gt=s=>{let e=s.length*.75,t=s.length,n,i=0,r,a,c,o;s[s.length-1]==="="&&(e--,s[s.length-2]==="="&&e--);const g=new ArrayBuffer(e),h=new Uint8Array(g);for(n=0;n<t;n+=4)r=H[s.charCodeAt(n)],a=H[s.charCodeAt(n+1)],c=H[s.charCodeAt(n+2)],o=H[s.charCodeAt(n+3)],h[i++]=r<<2|a>>4,h[i++]=(a&15)<<4|c>>2,h[i++]=(c&3)<<6|o&63;return g},mt=typeof ArrayBuffer=="function",pe=(s,e)=>{if(typeof s!="string")return{type:"message",data:Pe(s,e)};const t=s.charAt(0);return t==="b"?{type:"message",data:yt(s.substring(1),e)}:J[t]?s.length>1?{type:J[t],data:s.substring(1)}:{type:J[t]}:le},yt=(s,e)=>{if(mt){const t=gt(s);return Pe(t,e)}else return{base64:!0,data:s}},Pe=(s,e)=>{switch(e){case"blob":return s instanceof Blob?s:new Blob([s]);case"arraybuffer":default:return s instanceof ArrayBuffer?s:s.buffer}},De="",bt=(s,e)=>{const t=s.length,n=new Array(t);let i=0;s.forEach((r,a)=>{he(r,!1,c=>{n[a]=c,++i===t&&e(n.join(De))})})},xt=(s,e)=>{const t=s.split(De),n=[];for(let i=0;i<t.length;i++){const r=pe(t[i],e);if(n.push(r),r.type==="error")break}return n};function vt(){return new TransformStream({transform(s,e){ft(s,t=>{const n=t.length;let i;if(n<126)i=new Uint8Array(1),new DataView(i.buffer).setUint8(0,n);else if(n<65536){i=new Uint8Array(3);const r=new DataView(i.buffer);r.setUint8(0,126),r.setUint16(1,n)}else{i=new Uint8Array(9);const r=new DataView(i.buffer);r.setUint8(0,127),r.setBigUint64(1,BigInt(n))}s.data&&typeof s.data!="string"&&(i[0]|=128),e.enqueue(i),e.enqueue(t)})}})}let ue;function X(s){return s.reduce((e,t)=>e+t.length,0)}function Q(s,e){if(s[0].length===e)return s.shift();const t=new Uint8Array(e);let n=0;for(let i=0;i<e;i++)t[i]=s[0][n++],n===s[0].length&&(s.shift(),n=0);return s.length&&n<s[0].length&&(s[0]=s[0].slice(n)),t}function wt(s,e){ue||(ue=new TextDecoder);const t=[];let n=0,i=-1,r=!1;return new TransformStream({transform(a,c){for(t.push(a);;){if(n===0){if(X(t)<1)break;const o=Q(t,1);r=(o[0]&128)===128,i=o[0]&127,i<126?n=3:i===126?n=1:n=2}else if(n===1){if(X(t)<2)break;const o=Q(t,2);i=new DataView(o.buffer,o.byteOffset,o.length).getUint16(0),n=3}else if(n===2){if(X(t)<8)break;const o=Q(t,8),g=new DataView(o.buffer,o.byteOffset,o.length),h=g.getUint32(0);if(h>Math.pow(2,21)-1){c.enqueue(le);break}i=h*Math.pow(2,32)+g.getUint32(4),n=3}else{if(X(t)<i)break;const o=Q(t,i);c.enqueue(pe(r?o:ue.decode(o),e)),n=0}if(i===0||i>s){c.enqueue(le);break}}}})}const Me=4;function b(s){if(s)return _t(s)}function _t(s){for(var e in b.prototype)s[e]=b.prototype[e];return s}b.prototype.on=b.prototype.addEventListener=function(s,e){return this._callbacks=this._callbacks||{},(this._callbacks["$"+s]=this._callbacks["$"+s]||[]).push(e),this},b.prototype.once=function(s,e){function t(){this.off(s,t),e.apply(this,arguments)}return t.fn=e,this.on(s,t),this},b.prototype.off=b.prototype.removeListener=b.prototype.removeAllListeners=b.prototype.removeEventListener=function(s,e){if(this._callbacks=this._callbacks||{},arguments.length==0)return this._callbacks={},this;var t=this._callbacks["$"+s];if(!t)return this;if(arguments.length==1)return delete this._callbacks["$"+s],this;for(var n,i=0;i<t.length;i++)if(n=t[i],n===e||n.fn===e){t.splice(i,1);break}return t.length===0&&delete this._callbacks["$"+s],this},b.prototype.emit=function(s){this._callbacks=this._callbacks||{};for(var e=new Array(arguments.length-1),t=this._callbacks["$"+s],n=1;n<arguments.length;n++)e[n-1]=arguments[n];if(t){t=t.slice(0);for(var n=0,i=t.length;n<i;++n)t[n].apply(this,e)}return this},b.prototype.emitReserved=b.prototype.emit,b.prototype.listeners=function(s){return this._callbacks=this._callbacks||{},this._callbacks["$"+s]||[]},b.prototype.hasListeners=function(s){return!!this.listeners(s).length};const G=typeof Promise=="function"&&typeof Promise.resolve=="function"?e=>Promise.resolve().then(e):(e,t)=>t(e,0),S=typeof self!="undefined"?self:typeof window!="undefined"?window:Function("return this")(),kt="arraybuffer";function Gs(){}function Ue(s,...e){return e.reduce((t,n)=>(s.hasOwnProperty(n)&&(t[n]=s[n]),t),{})}const Et=S.setTimeout,St=S.clearTimeout;function Z(s,e){e.useNativeTimers?(s.setTimeoutFn=Et.bind(S),s.clearTimeoutFn=St.bind(S)):(s.setTimeoutFn=S.setTimeout.bind(S),s.clearTimeoutFn=S.clearTimeout.bind(S))}const Tt=1.33;function At(s){return typeof s=="string"?Ot(s):Math.ceil((s.byteLength||s.size)*Tt)}function Ot(s){let e=0,t=0;for(let n=0,i=s.length;n<i;n++)e=s.charCodeAt(n),e<128?t+=1:e<2048?t+=2:e<55296||e>=57344?t+=3:(n++,t+=4);return t}function ze(){return Date.now().toString(36).substring(3)+Math.random().toString(36).substring(2,5)}function Bt(s){let e="";for(let t in s)s.hasOwnProperty(t)&&(e.length&&(e+="&"),e+=encodeURIComponent(t)+"="+encodeURIComponent(s[t]));return e}function Rt(s){let e={},t=s.split("&");for(let n=0,i=t.length;n<i;n++){let r=t[n].split("=");e[decodeURIComponent(r[0])]=decodeURIComponent(r[1])}return e}class Lt extends Error{constructor(e,t,n){super(e),this.description=t,this.context=n,this.type="TransportError"}}class fe extends b{constructor(e){super(),this.writable=!1,Z(this,e),this.opts=e,this.query=e.query,this.socket=e.socket,this.supportsBinary=!e.forceBase64}onError(e,t,n){return super.emitReserved("error",new Lt(e,t,n)),this}open(){return this.readyState="opening",this.doOpen(),this}close(){return(this.readyState==="opening"||this.readyState==="open")&&(this.doClose(),this.onClose()),this}send(e){this.readyState==="open"&&this.write(e)}onOpen(){this.readyState="open",this.writable=!0,super.emitReserved("open")}onData(e){const t=pe(e,this.socket.binaryType);this.onPacket(t)}onPacket(e){super.emitReserved("packet",e)}onClose(e){this.readyState="closed",super.emitReserved("close",e)}pause(e){}createUri(e,t={}){return e+"://"+this._hostname()+this._port()+this.opts.path+this._query(t)}_hostname(){const e=this.opts.hostname;return e.indexOf(":")===-1?e:"["+e+"]"}_port(){return this.opts.port&&(this.opts.secure&&Number(this.opts.port)!==443||!this.opts.secure&&Number(this.opts.port)!==80)?":"+this.opts.port:""}_query(e){const t=Bt(e);return t.length?"?"+t:""}}class It extends fe{constructor(){super(...arguments),this._polling=!1}get name(){return"polling"}doOpen(){this._poll()}pause(e){this.readyState="pausing";const t=()=>{this.readyState="paused",e()};if(this._polling||!this.writable){let n=0;this._polling&&(n++,this.once("pollComplete",function(){--n||t()})),this.writable||(n++,this.once("drain",function(){--n||t()}))}else t()}_poll(){this._polling=!0,this.doPoll(),this.emitReserved("poll")}onData(e){const t=n=>{if(this.readyState==="opening"&&n.type==="open"&&this.onOpen(),n.type==="close")return this.onClose({description:"transport closed by the server"}),!1;this.onPacket(n)};xt(e,this.socket.binaryType).forEach(t),this.readyState!=="closed"&&(this._polling=!1,this.emitReserved("pollComplete"),this.readyState==="open"&&this._poll())}doClose(){const e=()=>{this.write([{type:"close"}])};this.readyState==="open"?e():this.once("open",e)}write(e){this.writable=!1,bt(e,t=>{this.doWrite(t,()=>{this.writable=!0,this.emitReserved("drain")})})}uri(){const e=this.opts.secure?"https":"http",t=this.query||{};return this.opts.timestampRequests!==!1&&(t[this.opts.timestampParam]=ze()),!this.supportsBinary&&!t.sid&&(t.b64=1),this.createUri(e,t)}}let Fe=!1;try{Fe=typeof XMLHttpRequest!="undefined"&&"withCredentials"in new XMLHttpRequest}catch(s){}const Ct=Fe;function Nt(){}class qt extends It{constructor(e){if(super(e),typeof location!="undefined"){const t=location.protocol==="https:";let n=location.port;n||(n=t?"443":"80"),this.xd=typeof location!="undefined"&&e.hostname!==location.hostname||n!==e.port}}doWrite(e,t){const n=this.request({method:"POST",data:e});n.on("success",t),n.on("error",(i,r)=>{this.onError("xhr post error",i,r)})}doPoll(){const e=this.request();e.on("data",this.onData.bind(this)),e.on("error",(t,n)=>{this.onError("xhr poll error",t,n)}),this.pollXhr=e}}class L extends b{constructor(e,t,n){super(),this.createRequest=e,Z(this,n),this._opts=n,this._method=n.method||"GET",this._uri=t,this._data=n.data!==void 0?n.data:null,this._create()}_create(){var e;const t=Ue(this._opts,"agent","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","autoUnref");t.xdomain=!!this._opts.xd;const n=this._xhr=this.createRequest(t);try{n.open(this._method,this._uri,!0);try{if(this._opts.extraHeaders){n.setDisableHeaderCheck&&n.setDisableHeaderCheck(!0);for(let i in this._opts.extraHeaders)this._opts.extraHeaders.hasOwnProperty(i)&&n.setRequestHeader(i,this._opts.extraHeaders[i])}}catch(i){}if(this._method==="POST")try{n.setRequestHeader("Content-type","text/plain;charset=UTF-8")}catch(i){}try{n.setRequestHeader("Accept","*/*")}catch(i){}(e=this._opts.cookieJar)===null||e===void 0||e.addCookies(n),"withCredentials"in n&&(n.withCredentials=this._opts.withCredentials),this._opts.requestTimeout&&(n.timeout=this._opts.requestTimeout),n.onreadystatechange=()=>{var i;n.readyState===3&&((i=this._opts.cookieJar)===null||i===void 0||i.parseCookies(n.getResponseHeader("set-cookie"))),n.readyState===4&&(n.status===200||n.status===1223?this._onLoad():this.setTimeoutFn(()=>{this._onError(typeof n.status=="number"?n.status:0)},0))},n.send(this._data)}catch(i){this.setTimeoutFn(()=>{this._onError(i)},0);return}typeof document!="undefined"&&(this._index=L.requestsCount++,L.requests[this._index]=this)}_onError(e){this.emitReserved("error",e,this._xhr),this._cleanup(!0)}_cleanup(e){if(!(typeof this._xhr=="undefined"||this._xhr===null)){if(this._xhr.onreadystatechange=Nt,e)try{this._xhr.abort()}catch(t){}typeof document!="undefined"&&delete L.requests[this._index],this._xhr=null}}_onLoad(){const e=this._xhr.responseText;e!==null&&(this.emitReserved("data",e),this.emitReserved("success"),this._cleanup())}abort(){this._cleanup()}}if(L.requestsCount=0,L.requests={},typeof document!="undefined"){if(typeof attachEvent=="function")attachEvent("onunload",He);else if(typeof addEventListener=="function"){const s="onpagehide"in S?"pagehide":"unload";addEventListener(s,He,!1)}}function He(){for(let s in L.requests)L.requests.hasOwnProperty(s)&&L.requests[s].abort()}const $t=(function(){const s=Ve({xdomain:!1});return s&&s.responseType!==null})();class Pt extends qt{constructor(e){super(e);const t=e&&e.forceBase64;this.supportsBinary=$t&&!t}request(e={}){return Object.assign(e,{xd:this.xd},this.opts),new L(Ve,this.uri(),e)}}function Ve(s){const e=s.xdomain;try{if(typeof XMLHttpRequest!="undefined"&&(!e||Ct))return new XMLHttpRequest}catch(t){}if(!e)try{return new S[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP")}catch(t){}}const Ke=typeof navigator!="undefined"&&typeof navigator.product=="string"&&navigator.product.toLowerCase()==="reactnative";class Dt extends fe{get name(){return"websocket"}doOpen(){const e=this.uri(),t=this.opts.protocols,n=Ke?{}:Ue(this.opts,"agent","perMessageDeflate","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","localAddress","protocolVersion","origin","maxPayload","family","checkServerIdentity");this.opts.extraHeaders&&(n.headers=this.opts.extraHeaders);try{this.ws=this.createSocket(e,t,n)}catch(i){return this.emitReserved("error",i)}this.ws.binaryType=this.socket.binaryType,this.addEventListeners()}addEventListeners(){this.ws.onopen=()=>{this.opts.autoUnref&&this.ws._socket.unref(),this.onOpen()},this.ws.onclose=e=>this.onClose({description:"websocket connection closed",context:e}),this.ws.onmessage=e=>this.onData(e.data),this.ws.onerror=e=>this.onError("websocket error",e)}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const n=e[t],i=t===e.length-1;he(n,this.supportsBinary,r=>{try{this.doWrite(n,r)}catch(a){}i&&G(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){typeof this.ws!="undefined"&&(this.ws.onerror=()=>{},this.ws.close(),this.ws=null)}uri(){const e=this.opts.secure?"wss":"ws",t=this.query||{};return this.opts.timestampRequests&&(t[this.opts.timestampParam]=ze()),this.supportsBinary||(t.b64=1),this.createUri(e,t)}}const ge=S.WebSocket||S.MozWebSocket;class Mt extends Dt{createSocket(e,t,n){return Ke?new ge(e,t,n):t?new ge(e,t):new ge(e)}doWrite(e,t){this.ws.send(t)}}class Ut extends fe{get name(){return"webtransport"}doOpen(){try{this._transport=new WebTransport(this.createUri("https"),this.opts.transportOptions[this.name])}catch(e){return this.emitReserved("error",e)}this._transport.closed.then(()=>{this.onClose()}).catch(e=>{this.onError("webtransport error",e)}),this._transport.ready.then(()=>{this._transport.createBidirectionalStream().then(e=>{const t=wt(Number.MAX_SAFE_INTEGER,this.socket.binaryType),n=e.readable.pipeThrough(t).getReader(),i=vt();i.readable.pipeTo(e.writable),this._writer=i.writable.getWriter();const r=()=>{n.read().then(({done:c,value:o})=>{c||(this.onPacket(o),r())}).catch(c=>{})};r();const a={type:"open"};this.query.sid&&(a.data=`{"sid":"${this.query.sid}"}`),this._writer.write(a).then(()=>this.onOpen())})})}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const n=e[t],i=t===e.length-1;this._writer.write(n).then(()=>{i&&G(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){var e;(e=this._transport)===null||e===void 0||e.close()}}const zt={websocket:Mt,webtransport:Ut,polling:Pt},Ft=/^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,Ht=["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"];function me(s){if(s.length>8e3)throw"URI too long";const e=s,t=s.indexOf("["),n=s.indexOf("]");t!=-1&&n!=-1&&(s=s.substring(0,t)+s.substring(t,n).replace(/:/g,";")+s.substring(n,s.length));let i=Ft.exec(s||""),r={},a=14;for(;a--;)r[Ht[a]]=i[a]||"";return t!=-1&&n!=-1&&(r.source=e,r.host=r.host.substring(1,r.host.length-1).replace(/;/g,":"),r.authority=r.authority.replace("[","").replace("]","").replace(/;/g,":"),r.ipv6uri=!0),r.pathNames=Vt(r,r.path),r.queryKey=Kt(r,r.query),r}function Vt(s,e){const t=/\/{2,9}/g,n=e.replace(t,"/").split("/");return(e.slice(0,1)=="/"||e.length===0)&&n.splice(0,1),e.slice(-1)=="/"&&n.splice(n.length-1,1),n}function Kt(s,e){const t={};return e.replace(/(?:^|&)([^&=]*)=?([^&]*)/g,function(n,i,r){i&&(t[i]=r)}),t}const ye=typeof addEventListener=="function"&&typeof removeEventListener=="function",ee=[];ye&&addEventListener("offline",()=>{ee.forEach(s=>s())},!1);class q extends b{constructor(e,t){if(super(),this.binaryType=kt,this.writeBuffer=[],this._prevBufferLen=0,this._pingInterval=-1,this._pingTimeout=-1,this._maxPayload=-1,this._pingTimeoutTime=1/0,e&&typeof e=="object"&&(t=e,e=null),e){const n=me(e);t.hostname=n.host,t.secure=n.protocol==="https"||n.protocol==="wss",t.port=n.port,n.query&&(t.query=n.query)}else t.host&&(t.hostname=me(t.host).host);Z(this,t),this.secure=t.secure!=null?t.secure:typeof location!="undefined"&&location.protocol==="https:",t.hostname&&!t.port&&(t.port=this.secure?"443":"80"),this.hostname=t.hostname||(typeof location!="undefined"?location.hostname:"localhost"),this.port=t.port||(typeof location!="undefined"&&location.port?location.port:this.secure?"443":"80"),this.transports=[],this._transportsByName={},t.transports.forEach(n=>{const i=n.prototype.name;this.transports.push(i),this._transportsByName[i]=n}),this.opts=Object.assign({path:"/engine.io",agent:!1,withCredentials:!1,upgrade:!0,timestampParam:"t",rememberUpgrade:!1,addTrailingSlash:!0,rejectUnauthorized:!0,perMessageDeflate:{threshold:1024},transportOptions:{},closeOnBeforeunload:!1},t),this.opts.path=this.opts.path.replace(/\/$/,"")+(this.opts.addTrailingSlash?"/":""),typeof this.opts.query=="string"&&(this.opts.query=Rt(this.opts.query)),ye&&(this.opts.closeOnBeforeunload&&(this._beforeunloadEventListener=()=>{this.transport&&(this.transport.removeAllListeners(),this.transport.close())},addEventListener("beforeunload",this._beforeunloadEventListener,!1)),this.hostname!=="localhost"&&(this._offlineEventListener=()=>{this._onClose("transport close",{description:"network connection lost"})},ee.push(this._offlineEventListener))),this.opts.withCredentials&&(this._cookieJar=void 0),this._open()}createTransport(e){const t=Object.assign({},this.opts.query);t.EIO=Me,t.transport=e,this.id&&(t.sid=this.id);const n=Object.assign({},this.opts,{query:t,socket:this,hostname:this.hostname,secure:this.secure,port:this.port},this.opts.transportOptions[e]);return new this._transportsByName[e](n)}_open(){if(this.transports.length===0){this.setTimeoutFn(()=>{this.emitReserved("error","No transports available")},0);return}const e=this.opts.rememberUpgrade&&q.priorWebsocketSuccess&&this.transports.indexOf("websocket")!==-1?"websocket":this.transports[0];this.readyState="opening";const t=this.createTransport(e);t.open(),this.setTransport(t)}setTransport(e){this.transport&&this.transport.removeAllListeners(),this.transport=e,e.on("drain",this._onDrain.bind(this)).on("packet",this._onPacket.bind(this)).on("error",this._onError.bind(this)).on("close",t=>this._onClose("transport close",t))}onOpen(){this.readyState="open",q.priorWebsocketSuccess=this.transport.name==="websocket",this.emitReserved("open"),this.flush()}_onPacket(e){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing")switch(this.emitReserved("packet",e),this.emitReserved("heartbeat"),e.type){case"open":this.onHandshake(JSON.parse(e.data));break;case"ping":this._sendPacket("pong"),this.emitReserved("ping"),this.emitReserved("pong"),this._resetPingTimeout();break;case"error":const t=new Error("server error");t.code=e.data,this._onError(t);break;case"message":this.emitReserved("data",e.data),this.emitReserved("message",e.data);break}}onHandshake(e){this.emitReserved("handshake",e),this.id=e.sid,this.transport.query.sid=e.sid,this._pingInterval=e.pingInterval,this._pingTimeout=e.pingTimeout,this._maxPayload=e.maxPayload,this.onOpen(),this.readyState!=="closed"&&this._resetPingTimeout()}_resetPingTimeout(){this.clearTimeoutFn(this._pingTimeoutTimer);const e=this._pingInterval+this._pingTimeout;this._pingTimeoutTime=Date.now()+e,this._pingTimeoutTimer=this.setTimeoutFn(()=>{this._onClose("ping timeout")},e),this.opts.autoUnref&&this._pingTimeoutTimer.unref()}_onDrain(){this.writeBuffer.splice(0,this._prevBufferLen),this._prevBufferLen=0,this.writeBuffer.length===0?this.emitReserved("drain"):this.flush()}flush(){if(this.readyState!=="closed"&&this.transport.writable&&!this.upgrading&&this.writeBuffer.length){const e=this._getWritablePackets();this.transport.send(e),this._prevBufferLen=e.length,this.emitReserved("flush")}}_getWritablePackets(){if(!(this._maxPayload&&this.transport.name==="polling"&&this.writeBuffer.length>1))return this.writeBuffer;let t=1;for(let n=0;n<this.writeBuffer.length;n++){const i=this.writeBuffer[n].data;if(i&&(t+=At(i)),n>0&&t>this._maxPayload)return this.writeBuffer.slice(0,n);t+=2}return this.writeBuffer}_hasPingExpired(){if(!this._pingTimeoutTime)return!0;const e=Date.now()>this._pingTimeoutTime;return e&&(this._pingTimeoutTime=0,G(()=>{this._onClose("ping timeout")},this.setTimeoutFn)),e}write(e,t,n){return this._sendPacket("message",e,t,n),this}send(e,t,n){return this._sendPacket("message",e,t,n),this}_sendPacket(e,t,n,i){if(typeof t=="function"&&(i=t,t=void 0),typeof n=="function"&&(i=n,n=null),this.readyState==="closing"||this.readyState==="closed")return;n=n||{},n.compress=n.compress!==!1;const r={type:e,data:t,options:n};this.emitReserved("packetCreate",r),this.writeBuffer.push(r),i&&this.once("flush",i),this.flush()}close(){const e=()=>{this._onClose("forced close"),this.transport.close()},t=()=>{this.off("upgrade",t),this.off("upgradeError",t),e()},n=()=>{this.once("upgrade",t),this.once("upgradeError",t)};return(this.readyState==="opening"||this.readyState==="open")&&(this.readyState="closing",this.writeBuffer.length?this.once("drain",()=>{this.upgrading?n():e()}):this.upgrading?n():e()),this}_onError(e){if(q.priorWebsocketSuccess=!1,this.opts.tryAllTransports&&this.transports.length>1&&this.readyState==="opening")return this.transports.shift(),this._open();this.emitReserved("error",e),this._onClose("transport error",e)}_onClose(e,t){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing"){if(this.clearTimeoutFn(this._pingTimeoutTimer),this.transport.removeAllListeners("close"),this.transport.close(),this.transport.removeAllListeners(),ye&&(this._beforeunloadEventListener&&removeEventListener("beforeunload",this._beforeunloadEventListener,!1),this._offlineEventListener)){const n=ee.indexOf(this._offlineEventListener);n!==-1&&ee.splice(n,1)}this.readyState="closed",this.id=null,this.emitReserved("close",e,t),this.writeBuffer=[],this._prevBufferLen=0}}}q.protocol=Me;class jt extends q{constructor(){super(...arguments),this._upgrades=[]}onOpen(){if(super.onOpen(),this.readyState==="open"&&this.opts.upgrade)for(let e=0;e<this._upgrades.length;e++)this._probe(this._upgrades[e])}_probe(e){let t=this.createTransport(e),n=!1;q.priorWebsocketSuccess=!1;const i=()=>{n||(t.send([{type:"ping",data:"probe"}]),t.once("packet",d=>{if(!n)if(d.type==="pong"&&d.data==="probe"){if(this.upgrading=!0,this.emitReserved("upgrading",t),!t)return;q.priorWebsocketSuccess=t.name==="websocket",this.transport.pause(()=>{n||this.readyState!=="closed"&&(h(),this.setTransport(t),t.send([{type:"upgrade"}]),this.emitReserved("upgrade",t),t=null,this.upgrading=!1,this.flush())})}else{const k=new Error("probe error");k.transport=t.name,this.emitReserved("upgradeError",k)}}))};function r(){n||(n=!0,h(),t.close(),t=null)}const a=d=>{const k=new Error("probe error: "+d);k.transport=t.name,r(),this.emitReserved("upgradeError",k)};function c(){a("transport closed")}function o(){a("socket closed")}function g(d){t&&d.name!==t.name&&r()}const h=()=>{t.removeListener("open",i),t.removeListener("error",a),t.removeListener("close",c),this.off("close",o),this.off("upgrading",g)};t.once("open",i),t.once("error",a),t.once("close",c),this.once("close",o),this.once("upgrading",g),this._upgrades.indexOf("webtransport")!==-1&&e!=="webtransport"?this.setTimeoutFn(()=>{n||t.open()},200):t.open()}onHandshake(e){this._upgrades=this._filterUpgrades(e.upgrades),super.onHandshake(e)}_filterUpgrades(e){const t=[];for(let n=0;n<e.length;n++)~this.transports.indexOf(e[n])&&t.push(e[n]);return t}}let Wt=class extends jt{constructor(e,t={}){const n=typeof e=="object"?e:t;(!n.transports||n.transports&&typeof n.transports[0]=="string")&&(n.transports=(n.transports||["polling","websocket","webtransport"]).map(i=>zt[i]).filter(i=>!!i)),super(e,n)}};function Yt(s,e="",t){let n=s;t=t||typeof location!="undefined"&&location,s==null&&(s=t.protocol+"//"+t.host),typeof s=="string"&&(s.charAt(0)==="/"&&(s.charAt(1)==="/"?s=t.protocol+s:s=t.host+s),/^(https?|wss?):\/\//.test(s)||(typeof t!="undefined"?s=t.protocol+"//"+s:s="https://"+s),n=me(s)),n.port||(/^(http|ws)$/.test(n.protocol)?n.port="80":/^(http|ws)s$/.test(n.protocol)&&(n.port="443")),n.path=n.path||"/";const r=n.host.indexOf(":")!==-1?"["+n.host+"]":n.host;return n.id=n.protocol+"://"+r+":"+n.port+e,n.href=n.protocol+"://"+r+(t&&t.port===n.port?"":":"+n.port),n}const Jt=typeof ArrayBuffer=="function",Xt=s=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(s):s.buffer instanceof ArrayBuffer,je=Object.prototype.toString,Qt=typeof Blob=="function"||typeof Blob!="undefined"&&je.call(Blob)==="[object BlobConstructor]",Gt=typeof File=="function"||typeof File!="undefined"&&je.call(File)==="[object FileConstructor]";function be(s){return Jt&&(s instanceof ArrayBuffer||Xt(s))||Qt&&s instanceof Blob||Gt&&s instanceof File}function te(s,e){if(!s||typeof s!="object")return!1;if(Array.isArray(s)){for(let t=0,n=s.length;t<n;t++)if(te(s[t]))return!0;return!1}if(be(s))return!0;if(s.toJSON&&typeof s.toJSON=="function"&&arguments.length===1)return te(s.toJSON(),!0);for(const t in s)if(Object.prototype.hasOwnProperty.call(s,t)&&te(s[t]))return!0;return!1}function Zt(s){const e=[],t=s.data,n=s;return n.data=xe(t,e),n.attachments=e.length,{packet:n,buffers:e}}function xe(s,e){if(!s)return s;if(be(s)){const t={_placeholder:!0,num:e.length};return e.push(s),t}else if(Array.isArray(s)){const t=new Array(s.length);for(let n=0;n<s.length;n++)t[n]=xe(s[n],e);return t}else if(typeof s=="object"&&!(s instanceof Date)){const t={};for(const n in s)Object.prototype.hasOwnProperty.call(s,n)&&(t[n]=xe(s[n],e));return t}return s}function es(s,e){return s.data=ve(s.data,e),delete s.attachments,s}function ve(s,e){if(!s)return s;if(s&&s._placeholder===!0){if(typeof s.num=="number"&&s.num>=0&&s.num<e.length)return e[s.num];throw new Error("illegal attachments")}else if(Array.isArray(s))for(let t=0;t<s.length;t++)s[t]=ve(s[t],e);else if(typeof s=="object")for(const t in s)Object.prototype.hasOwnProperty.call(s,t)&&(s[t]=ve(s[t],e));return s}const ts=["connect","connect_error","disconnect","disconnecting","newListener","removeListener"];var p;(function(s){s[s.CONNECT=0]="CONNECT",s[s.DISCONNECT=1]="DISCONNECT",s[s.EVENT=2]="EVENT",s[s.ACK=3]="ACK",s[s.CONNECT_ERROR=4]="CONNECT_ERROR",s[s.BINARY_EVENT=5]="BINARY_EVENT",s[s.BINARY_ACK=6]="BINARY_ACK"})(p||(p={}));class ss{constructor(e){this.replacer=e}encode(e){return(e.type===p.EVENT||e.type===p.ACK)&&te(e)?this.encodeAsBinary({type:e.type===p.EVENT?p.BINARY_EVENT:p.BINARY_ACK,nsp:e.nsp,data:e.data,id:e.id}):[this.encodeAsString(e)]}encodeAsString(e){let t=""+e.type;return(e.type===p.BINARY_EVENT||e.type===p.BINARY_ACK)&&(t+=e.attachments+"-"),e.nsp&&e.nsp!=="/"&&(t+=e.nsp+","),e.id!=null&&(t+=e.id),e.data!=null&&(t+=JSON.stringify(e.data,this.replacer)),t}encodeAsBinary(e){const t=Zt(e),n=this.encodeAsString(t.packet),i=t.buffers;return i.unshift(n),i}}class we extends b{constructor(e){super(),this.opts=Object.assign({reviver:void 0,maxAttachments:10},typeof e=="function"?{reviver:e}:e)}add(e){let t;if(typeof e=="string"){if(this.reconstructor)throw new Error("got plaintext data when reconstructing a packet");t=this.decodeString(e);const n=t.type===p.BINARY_EVENT;n||t.type===p.BINARY_ACK?(t.type=n?p.EVENT:p.ACK,this.reconstructor=new ns(t),t.attachments===0&&super.emitReserved("decoded",t)):super.emitReserved("decoded",t)}else if(be(e)||e.base64)if(this.reconstructor)t=this.reconstructor.takeBinaryData(e),t&&(this.reconstructor=null,super.emitReserved("decoded",t));else throw new Error("got binary data when not reconstructing a packet");else throw new Error("Unknown type: "+e)}decodeString(e){let t=0;const n={type:Number(e.charAt(0))};if(p[n.type]===void 0)throw new Error("unknown packet type "+n.type);if(n.type===p.BINARY_EVENT||n.type===p.BINARY_ACK){const r=t+1;for(;e.charAt(++t)!=="-"&&t!=e.length;);const a=e.substring(r,t);if(a!=Number(a)||e.charAt(t)!=="-")throw new Error("Illegal attachments");const c=Number(a);if(!is(c)||c<0)throw new Error("Illegal attachments");if(c>this.opts.maxAttachments)throw new Error("too many attachments");n.attachments=c}if(e.charAt(t+1)==="/"){const r=t+1;for(;++t&&!(e.charAt(t)===","||t===e.length););n.nsp=e.substring(r,t)}else n.nsp="/";const i=e.charAt(t+1);if(i!==""&&Number(i)==i){const r=t+1;for(;++t;){const a=e.charAt(t);if(a==null||Number(a)!=a){--t;break}if(t===e.length)break}n.id=Number(e.substring(r,t+1))}if(e.charAt(++t)){const r=this.tryParse(e.substr(t));if(we.isPayloadValid(n.type,r))n.data=r;else throw new Error("invalid payload")}return n}tryParse(e){try{return JSON.parse(e,this.opts.reviver)}catch(t){return!1}}static isPayloadValid(e,t){switch(e){case p.CONNECT:return We(t);case p.DISCONNECT:return t===void 0;case p.CONNECT_ERROR:return typeof t=="string"||We(t);case p.EVENT:case p.BINARY_EVENT:return Array.isArray(t)&&(typeof t[0]=="number"||typeof t[0]=="string"&&ts.indexOf(t[0])===-1);case p.ACK:case p.BINARY_ACK:return Array.isArray(t)}}destroy(){this.reconstructor&&(this.reconstructor.finishedReconstruction(),this.reconstructor=null)}}class ns{constructor(e){this.packet=e,this.buffers=[],this.reconPack=e}takeBinaryData(e){if(this.buffers.push(e),this.buffers.length===this.reconPack.attachments){const t=es(this.reconPack,this.buffers);return this.finishedReconstruction(),t}return null}finishedReconstruction(){this.reconPack=null,this.buffers=[]}}const is=Number.isInteger||function(s){return typeof s=="number"&&isFinite(s)&&Math.floor(s)===s};function We(s){return Object.prototype.toString.call(s)==="[object Object]"}const rs=Object.freeze(Object.defineProperty({__proto__:null,Decoder:we,Encoder:ss,get PacketType(){return p}},Symbol.toStringTag,{value:"Module"}));function A(s,e,t){return s.on(e,t),function(){s.off(e,t)}}const os=Object.freeze({connect:1,connect_error:1,disconnect:1,disconnecting:1,newListener:1,removeListener:1});class Ye extends b{constructor(e,t,n){super(),this.connected=!1,this.recovered=!1,this.receiveBuffer=[],this.sendBuffer=[],this._queue=[],this._queueSeq=0,this.ids=0,this.acks={},this.flags={},this.io=e,this.nsp=t,n&&n.auth&&(this.auth=n.auth),this._opts=Object.assign({},n),this.io._autoConnect&&this.open()}get disconnected(){return!this.connected}subEvents(){if(this.subs)return;const e=this.io;this.subs=[A(e,"open",this.onopen.bind(this)),A(e,"packet",this.onpacket.bind(this)),A(e,"error",this.onerror.bind(this)),A(e,"close",this.onclose.bind(this))]}get active(){return!!this.subs}connect(){return this.connected?this:(this.subEvents(),this.io._reconnecting||this.io.open(),this.io._readyState==="open"&&this.onopen(),this)}open(){return this.connect()}send(...e){return e.unshift("message"),this.emit.apply(this,e),this}emit(e,...t){var n,i,r;if(os.hasOwnProperty(e))throw new Error('"'+e.toString()+'" is a reserved event name');if(t.unshift(e),this._opts.retries&&!this.flags.fromQueue&&!this.flags.volatile)return this._addToQueue(t),this;const a={type:p.EVENT,data:t};if(a.options={},a.options.compress=this.flags.compress!==!1,typeof t[t.length-1]=="function"){const h=this.ids++,d=t.pop();this._registerAckCallback(h,d),a.id=h}const c=(i=(n=this.io.engine)===null||n===void 0?void 0:n.transport)===null||i===void 0?void 0:i.writable,o=this.connected&&!(!((r=this.io.engine)===null||r===void 0)&&r._hasPingExpired());return this.flags.volatile&&!c||(o?(this.notifyOutgoingListeners(a),this.packet(a)):this.sendBuffer.push(a)),this.flags={},this}_registerAckCallback(e,t){var n;const i=(n=this.flags.timeout)!==null&&n!==void 0?n:this._opts.ackTimeout;if(i===void 0){this.acks[e]=t;return}const r=this.io.setTimeoutFn(()=>{delete this.acks[e];for(let c=0;c<this.sendBuffer.length;c++)this.sendBuffer[c].id===e&&this.sendBuffer.splice(c,1);t.call(this,new Error("operation has timed out"))},i),a=(...c)=>{this.io.clearTimeoutFn(r),t.apply(this,c)};a.withError=!0,this.acks[e]=a}emitWithAck(e,...t){return new Promise((n,i)=>{const r=(a,c)=>a?i(a):n(c);r.withError=!0,t.push(r),this.emit(e,...t)})}_addToQueue(e){let t;typeof e[e.length-1]=="function"&&(t=e.pop());const n={id:this._queueSeq++,tryCount:0,pending:!1,args:e,flags:Object.assign({fromQueue:!0},this.flags)};e.push((i,...r)=>(this._queue[0],i!==null?n.tryCount>this._opts.retries&&(this._queue.shift(),t&&t(i)):(this._queue.shift(),t&&t(null,...r)),n.pending=!1,this._drainQueue())),this._queue.push(n),this._drainQueue()}_drainQueue(e=!1){if(!this.connected||this._queue.length===0)return;const t=this._queue[0];t.pending&&!e||(t.pending=!0,t.tryCount++,this.flags=t.flags,this.emit.apply(this,t.args))}packet(e){e.nsp=this.nsp,this.io._packet(e)}onopen(){typeof this.auth=="function"?this.auth(e=>{this._sendConnectPacket(e)}):this._sendConnectPacket(this.auth)}_sendConnectPacket(e){this.packet({type:p.CONNECT,data:this._pid?Object.assign({pid:this._pid,offset:this._lastOffset},e):e})}onerror(e){this.connected||this.emitReserved("connect_error",e)}onclose(e,t){this.connected=!1,delete this.id,this.emitReserved("disconnect",e,t),this._clearAcks()}_clearAcks(){Object.keys(this.acks).forEach(e=>{if(!this.sendBuffer.some(n=>String(n.id)===e)){const n=this.acks[e];delete this.acks[e],n.withError&&n.call(this,new Error("socket has been disconnected"))}})}onpacket(e){if(e.nsp===this.nsp)switch(e.type){case p.CONNECT:e.data&&e.data.sid?this.onconnect(e.data.sid,e.data.pid):this.emitReserved("connect_error",new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));break;case p.EVENT:case p.BINARY_EVENT:this.onevent(e);break;case p.ACK:case p.BINARY_ACK:this.onack(e);break;case p.DISCONNECT:this.ondisconnect();break;case p.CONNECT_ERROR:this.destroy();const n=new Error(e.data.message);n.data=e.data.data,this.emitReserved("connect_error",n);break}}onevent(e){const t=e.data||[];e.id!=null&&t.push(this.ack(e.id)),this.connected?this.emitEvent(t):this.receiveBuffer.push(Object.freeze(t))}emitEvent(e){if(this._anyListeners&&this._anyListeners.length){const t=this._anyListeners.slice();for(const n of t)n.apply(this,e)}super.emit.apply(this,e),this._pid&&e.length&&typeof e[e.length-1]=="string"&&(this._lastOffset=e[e.length-1])}ack(e){const t=this;let n=!1;return function(...i){n||(n=!0,t.packet({type:p.ACK,id:e,data:i}))}}onack(e){const t=this.acks[e.id];typeof t=="function"&&(delete this.acks[e.id],t.withError&&e.data.unshift(null),t.apply(this,e.data))}onconnect(e,t){this.id=e,this.recovered=t&&this._pid===t,this._pid=t,this.connected=!0,this.emitBuffered(),this._drainQueue(!0),this.emitReserved("connect")}emitBuffered(){this.receiveBuffer.forEach(e=>this.emitEvent(e)),this.receiveBuffer=[],this.sendBuffer.forEach(e=>{this.notifyOutgoingListeners(e),this.packet(e)}),this.sendBuffer=[]}ondisconnect(){this.destroy(),this.onclose("io server disconnect")}destroy(){this.subs&&(this.subs.forEach(e=>e()),this.subs=void 0),this.io._destroy(this)}disconnect(){return this.connected&&this.packet({type:p.DISCONNECT}),this.destroy(),this.connected&&this.onclose("io client disconnect"),this}close(){return this.disconnect()}compress(e){return this.flags.compress=e,this}get volatile(){return this.flags.volatile=!0,this}timeout(e){return this.flags.timeout=e,this}onAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.push(e),this}prependAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.unshift(e),this}offAny(e){if(!this._anyListeners)return this;if(e){const t=this._anyListeners;for(let n=0;n<t.length;n++)if(e===t[n])return t.splice(n,1),this}else this._anyListeners=[];return this}listenersAny(){return this._anyListeners||[]}onAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.push(e),this}prependAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.unshift(e),this}offAnyOutgoing(e){if(!this._anyOutgoingListeners)return this;if(e){const t=this._anyOutgoingListeners;for(let n=0;n<t.length;n++)if(e===t[n])return t.splice(n,1),this}else this._anyOutgoingListeners=[];return this}listenersAnyOutgoing(){return this._anyOutgoingListeners||[]}notifyOutgoingListeners(e){if(this._anyOutgoingListeners&&this._anyOutgoingListeners.length){const t=this._anyOutgoingListeners.slice();for(const n of t)n.apply(this,e.data)}}}function z(s){s=s||{},this.ms=s.min||100,this.max=s.max||1e4,this.factor=s.factor||2,this.jitter=s.jitter>0&&s.jitter<=1?s.jitter:0,this.attempts=0}z.prototype.duration=function(){var s=this.ms*Math.pow(this.factor,this.attempts++);if(this.jitter){var e=Math.random(),t=Math.floor(e*this.jitter*s);s=(Math.floor(e*10)&1)==0?s-t:s+t}return Math.min(s,this.max)|0},z.prototype.reset=function(){this.attempts=0},z.prototype.setMin=function(s){this.ms=s},z.prototype.setMax=function(s){this.max=s},z.prototype.setJitter=function(s){this.jitter=s};class _e extends b{constructor(e,t){var n;super(),this.nsps={},this.subs=[],e&&typeof e=="object"&&(t=e,e=void 0),t=t||{},t.path=t.path||"/socket.io",this.opts=t,Z(this,t),this.reconnection(t.reconnection!==!1),this.reconnectionAttempts(t.reconnectionAttempts||1/0),this.reconnectionDelay(t.reconnectionDelay||1e3),this.reconnectionDelayMax(t.reconnectionDelayMax||5e3),this.randomizationFactor((n=t.randomizationFactor)!==null&&n!==void 0?n:.5),this.backoff=new z({min:this.reconnectionDelay(),max:this.reconnectionDelayMax(),jitter:this.randomizationFactor()}),this.timeout(t.timeout==null?2e4:t.timeout),this._readyState="closed",this.uri=e;const i=t.parser||rs;this.encoder=new i.Encoder,this.decoder=new i.Decoder,this._autoConnect=t.autoConnect!==!1,this._autoConnect&&this.open()}reconnection(e){return arguments.length?(this._reconnection=!!e,e||(this.skipReconnect=!0),this):this._reconnection}reconnectionAttempts(e){return e===void 0?this._reconnectionAttempts:(this._reconnectionAttempts=e,this)}reconnectionDelay(e){var t;return e===void 0?this._reconnectionDelay:(this._reconnectionDelay=e,(t=this.backoff)===null||t===void 0||t.setMin(e),this)}randomizationFactor(e){var t;return e===void 0?this._randomizationFactor:(this._randomizationFactor=e,(t=this.backoff)===null||t===void 0||t.setJitter(e),this)}reconnectionDelayMax(e){var t;return e===void 0?this._reconnectionDelayMax:(this._reconnectionDelayMax=e,(t=this.backoff)===null||t===void 0||t.setMax(e),this)}timeout(e){return arguments.length?(this._timeout=e,this):this._timeout}maybeReconnectOnOpen(){!this._reconnecting&&this._reconnection&&this.backoff.attempts===0&&this.reconnect()}open(e){if(~this._readyState.indexOf("open"))return this;this.engine=new Wt(this.uri,this.opts);const t=this.engine,n=this;this._readyState="opening",this.skipReconnect=!1;const i=A(t,"open",function(){n.onopen(),e&&e()}),r=c=>{this.cleanup(),this._readyState="closed",this.emitReserved("error",c),e?e(c):this.maybeReconnectOnOpen()},a=A(t,"error",r);if(this._timeout!==!1){const c=this._timeout,o=this.setTimeoutFn(()=>{i(),r(new Error("timeout")),t.close()},c);this.opts.autoUnref&&o.unref(),this.subs.push(()=>{this.clearTimeoutFn(o)})}return this.subs.push(i),this.subs.push(a),this}connect(e){return this.open(e)}onopen(){this.cleanup(),this._readyState="open",this.emitReserved("open");const e=this.engine;this.subs.push(A(e,"ping",this.onping.bind(this)),A(e,"data",this.ondata.bind(this)),A(e,"error",this.onerror.bind(this)),A(e,"close",this.onclose.bind(this)),A(this.decoder,"decoded",this.ondecoded.bind(this)))}onping(){this.emitReserved("ping")}ondata(e){try{this.decoder.add(e)}catch(t){this.onclose("parse error",t)}}ondecoded(e){G(()=>{this.emitReserved("packet",e)},this.setTimeoutFn)}onerror(e){this.emitReserved("error",e)}socket(e,t){let n=this.nsps[e];return n?this._autoConnect&&!n.active&&n.connect():(n=new Ye(this,e,t),this.nsps[e]=n),n}_destroy(e){const t=Object.keys(this.nsps);for(const n of t)if(this.nsps[n].active)return;this._close()}_packet(e){const t=this.encoder.encode(e);for(let n=0;n<t.length;n++)this.engine.write(t[n],e.options)}cleanup(){this.subs.forEach(e=>e()),this.subs.length=0,this.decoder.destroy()}_close(){this.skipReconnect=!0,this._reconnecting=!1,this.onclose("forced close")}disconnect(){return this._close()}onclose(e,t){var n;this.cleanup(),(n=this.engine)===null||n===void 0||n.close(),this.backoff.reset(),this._readyState="closed",this.emitReserved("close",e,t),this._reconnection&&!this.skipReconnect&&this.reconnect()}reconnect(){if(this._reconnecting||this.skipReconnect)return this;const e=this;if(this.backoff.attempts>=this._reconnectionAttempts)this.backoff.reset(),this.emitReserved("reconnect_failed"),this._reconnecting=!1;else{const t=this.backoff.duration();this._reconnecting=!0;const n=this.setTimeoutFn(()=>{e.skipReconnect||(this.emitReserved("reconnect_attempt",e.backoff.attempts),!e.skipReconnect&&e.open(i=>{i?(e._reconnecting=!1,e.reconnect(),this.emitReserved("reconnect_error",i)):e.onreconnect()}))},t);this.opts.autoUnref&&n.unref(),this.subs.push(()=>{this.clearTimeoutFn(n)})}}onreconnect(){const e=this.backoff.attempts;this._reconnecting=!1,this.backoff.reset(),this.emitReserved("reconnect",e)}}const V={};function se(s,e){typeof s=="object"&&(e=s,s=void 0),e=e||{};const t=Yt(s,e.path||"/socket.io"),n=t.source,i=t.id,r=t.path,a=V[i]&&r in V[i].nsps,c=e.forceNew||e["force new connection"]||e.multiplex===!1||a;let o;return c?o=new _e(n,e):(V[i]||(V[i]=new _e(n,e)),o=V[i]),t.query&&!e.query&&(e.query=t.queryKey),o.socket(t.path,e)}Object.assign(se,{Manager:_e,Socket:Ye,io:se,connect:se});function as(s,e,t){const n=s.apiBase||window.location.origin,i=se(n,{path:"/livechat-ws",auth:{siteKey:s.siteKey,visitorId:s.visitorId,sessionId:e},transports:["websocket","polling"],reconnection:!0,reconnectionDelay:600,reconnectionDelayMax:8e3});return i.on("livechat:event",r=>{r.sessionId===e&&t(r)}),i}const cs=`
:host {
  all: initial;
  position: fixed;
  bottom: 40px;
  right: 40px;
  z-index: 2147483646;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  color: #1f2937;
  --lc-brand: var(--lc-brand);
  --lc-brand-shadow: var(--lc-brand-shadow);
  --lc-brand-shadow-hover: var(--lc-brand-shadow-hover);
}
:host(.lc-position-left) {
  right: auto;
  left: 40px;
}

/* ── Bubble button ── */
.lc-bubble {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--lc-brand);
  color: #fff;
  border: 0;
  cursor: pointer;
  box-shadow: 0 6px 20px var(--lc-brand-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.lc-bubble:hover { transform: translateY(-2px); box-shadow: 0 10px 24px var(--lc-brand-shadow-hover); }
.lc-bubble svg { width: 24px; height: 24px; }

.lc-unread {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

/* ── Panel ── */
.lc-panel {
  position: absolute;
  bottom: 70px;
  right: 0;
  width: 370px;
  height: 580px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.16);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: lc-slide-in 0.22s ease;
}
:host(.lc-position-left) .lc-panel { right: auto; left: 0; }

@keyframes lc-slide-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes lc-slide-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(12px); }
}
.lc-panel--closing { animation: lc-slide-out 0.18s ease forwards; }

/* ── Header ── */
.lc-header {
  padding: 14px 16px;
  background: var(--lc-brand);
  background-image: radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px);
  background-size: 18px 18px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.lc-header-inner { display: flex; align-items: center; gap: 10px; min-width: 0; }
.lc-header-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  border: 2px solid rgba(255,255,255,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.lc-header-avatar svg { width: 20px; height: 20px; }
.lc-header-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lc-header-title { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lc-header-sub { font-size: 12px; opacity: 0.9; display: flex; align-items: center; gap: 5px; }
.lc-online-dot { width: 7px; height: 7px; background: #22c55e; border-radius: 50%; flex-shrink: 0; display: inline-block; }

.lc-close {
  background: rgba(255,255,255,0.15);
  border: 0;
  color: #fff;
  cursor: pointer;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}
.lc-close:hover { background: rgba(255,255,255,0.28); }
.lc-close svg { width: 16px; height: 16px; }

/* ── Messages area ── */
.lc-messages-wrap { flex: 1; overflow: hidden; position: relative; min-height: 0; }

.lc-messages {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 14px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-sizing: border-box;
}
.lc-messages::-webkit-scrollbar { width: 4px; }
.lc-messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }

/* ── Message rows ── */
.lc-msg-row { display: flex; align-items: flex-end; gap: 7px; max-width: 86%; }
.lc-msg-row-agent { align-self: flex-start; }
.lc-msg-row-visitor { align-self: flex-end; flex-direction: row-reverse; }

.lc-msg-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--lc-brand);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-bottom: 2px;
}
.lc-msg-avatar svg { width: 13px; height: 13px; }
.lc-msg-avatar-op { background: #374151; font-size: 10px; font-weight: 700; letter-spacing: 0.02em; }

.lc-msg-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.lc-msg-row-visitor .lc-msg-body { align-items: flex-end; }

.lc-msg-sender { font-size: 11px; color: #6b7280; font-weight: 500; padding: 0 3px; }
.lc-msg-time { font-size: 10px; color: #9ca3af; padding: 0 3px; }

.lc-msg { padding: 9px 13px; border-radius: 16px; font-size: 14px; line-height: 1.45; word-wrap: break-word; }
.lc-msg.lc-msg-visitor { background: var(--lc-brand); color: #fff; border-bottom-right-radius: 4px; }
.lc-msg.lc-msg-agent { background: #fff; color: #1f2937; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
.lc-msg.lc-msg-system { align-self: center; font-size: 11px; color: #9ca3af; background: transparent; padding: 4px 0; }
.lc-msg a { color: inherit; text-decoration: underline; word-break: break-all; }
.lc-msg.lc-msg-agent a { color: #2563eb; }
.lc-empty { text-align: center; color: #9ca3af; font-size: 13px; padding: 32px 16px; line-height: 1.5; }

/* ── Typing indicator ── */
.lc-typing {
  align-self: flex-start;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  padding: 10px 14px;
  display: flex;
  gap: 4px;
  margin-left: 33px;
}
.lc-typing span { width: 6px; height: 6px; background: #9ca3af; border-radius: 50%; animation: lc-bounce 1.2s infinite ease-in-out; }
.lc-typing span:nth-child(2) { animation-delay: 0.15s; }
.lc-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes lc-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }

/* ── Scroll-to-bottom button ── */
.lc-scroll-btn {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  color: #374151;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0,0,0,0.12);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 5px;
}
.lc-scroll-btn:hover { background: #f9fafb; }
.lc-scroll-btn svg { width: 13px; height: 13px; color: #6b7280; }

/* ── Toast notification ── */
.lc-toast {
  padding: 8px 14px;
  background: #1f2937;
  color: #f9fafb;
  font-size: 12px;
  text-align: center;
  flex-shrink: 0;
}

/* ── Quick replies ── */
.lc-quick-replies {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 14px 8px;
  background: #f9fafb;
  flex-shrink: 0;
}
.lc-quick-replies button {
  background: #fff;
  border: 1px solid var(--lc-brand);
  color: var(--lc-brand);
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
}
.lc-quick-replies button:hover { background: var(--lc-brand); color: #fff; }
.lc-quick-replies button:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Email + name identify ── */
.lc-identify {
  padding: 12px 14px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
  font-size: 13px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lc-identify-label { font-size: 12px; color: #6b7280; }
.lc-identify-row { display: flex; gap: 6px; }
.lc-identify input { flex: 1; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; outline: none; font: inherit; }
.lc-identify input:focus { border-color: var(--lc-brand); }
.lc-identify button { background: var(--lc-brand); color: #fff; border: 0; border-radius: 6px; padding: 0 12px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.lc-identify-skip { background: transparent !important; color: #9ca3af !important; font-size: 12px !important; padding: 2px 0 0 0 !important; cursor: pointer; border: 0; }

/* ── Pending attachments ── */
.lc-pending { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 12px 0 12px; background: #fff; flex-shrink: 0; }
.lc-chip { display: inline-flex; align-items: center; gap: 6px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; padding: 4px 8px; font-size: 12px; color: #1f2937; max-width: 240px; }
.lc-chip--busy { opacity: 0.6; }
.lc-chip-thumb { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.lc-chip-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lc-chip-uploading { color: #6b7280; font-style: italic; }
.lc-chip button { background: transparent; border: 0; padding: 0 0 0 2px; cursor: pointer; color: #6b7280; font-size: 14px; line-height: 1; }
.lc-chip button:hover { color: #1f2937; }

/* ── Session ended banner ── */
.lc-session-end {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  background: #fef9ec;
  border-top: 1px solid #fde68a;
  font-size: 12px;
  color: #92400e;
  flex-shrink: 0;
}
.lc-session-end-btn {
  background: #1f2937;
  color: #fff;
  border: 0;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.lc-session-end-btn:hover { background: #374151; }

/* ── Composer ── */
.lc-composer {
  border-top: 1px solid #e5e7eb;
  background: #fff;
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  align-items: flex-end;
  flex-shrink: 0;
}
.lc-composer textarea {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 8px 10px;
  resize: none;
  font: inherit;
  font-size: 14px;
  outline: none;
  min-height: 36px;
  max-height: 120px;
  line-height: 1.4;
  color: inherit;
}
.lc-composer textarea:focus { border-color: var(--lc-brand); }
.lc-composer button {
  background: var(--lc-brand);
  color: #fff;
  border: 0;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.lc-composer button:disabled { opacity: 0.4; cursor: not-allowed; }
.lc-composer button svg { width: 16px; height: 16px; }

/* ── Honeypot ── */
.lc-hp { position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px; opacity: 0; }

/* ── Attach button ── */
.lc-attach-btn { background: transparent; border: 0; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #6b7280; cursor: pointer; flex-shrink: 0; }
.lc-attach-btn:hover { background: #f3f4f6; color: #1f2937; }
.lc-attach-btn svg { width: 18px; height: 18px; }

/* ── Attachments in messages ── */
.lc-attachments { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.lc-attach-img { display: block; width: 100%; max-width: 220px; min-width: 80px; min-height: 60px; max-height: 200px; object-fit: contain; border-radius: 10px; cursor: zoom-in; background: #f3f4f6; }
.lc-attach-file { display: inline-flex; align-items: center; gap: 8px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; padding: 6px 10px; font-size: 12px; color: #1f2937; text-decoration: none; max-width: 240px; }
.lc-attach-file:hover { background: #e5e7eb; }
.lc-attach-file svg { width: 16px; height: 16px; flex-shrink: 0; color: #6b7280; }
.lc-attach-file span:first-of-type { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.lc-attach-file .lc-attach-size { color: #6b7280; flex-shrink: 0; }

/* ── Mobile ── */
/* On mobile the host is sized via the Visual Viewport API so it tracks
   exactly the visible area — URL bar, keyboard, and safe-area are all
   accounted for in JS. The panel fills 100% of that host element. */
@media (max-width: 480px) {
  .lc-panel {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    border-radius: 0;
    /* Block touch events from reaching the page behind the panel. */
    touch-action: none;
  }
  /* Safe-area insets: notch / status bar (top) and home indicator (bottom). */
  .lc-header {
    padding-top: calc(14px + env(safe-area-inset-top, 0px));
  }
  .lc-composer {
    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  }
  /* Allow vertical scroll in the messages area only. */
  .lc-messages {
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  /* Prevent iOS Safari from zooming in when an input is focused.
     Any font-size below 16px triggers the auto-zoom. */
  .lc-composer textarea,
  .lc-identify input {
    font-size: 16px;
  }
  /* Expand tap targets to the 44px minimum recommended for touch. */
  .lc-close {
    width: 44px;
    height: 44px;
  }
  .lc-attach-btn {
    width: 44px;
    height: 44px;
  }
}

/* Landscape + soft keyboard: very short viewport — tighten spacing so the
   composer stays visible without sacrificing the message area. */
@media (max-width: 480px) and (max-height: 400px) {
  .lc-header { padding-top: calc(8px + env(safe-area-inset-top, 0px)); padding-bottom: 8px; }
  .lc-messages { padding: 6px 12px; }
  .lc-composer { padding-top: 6px; padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px)); }
}
`,ls={siteKey:"",botName:"Hi there",botSubtitle:"We typically reply in a few seconds.",welcomeMessage:null,brandColor:"#2563eb",position:"bottom-right"},ke="livechat_messages_cache",Ee="livechat_session_id",ne="livechat_identify_dismissed",Je="livechat_send_log",hs=30,ds=6e4;function ps(s,e=ls){var ae;const t=document.createElement("div");t.id="livechat-widget-root",t.style.cssText="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;",document.body.appendChild(t);const n=t.attachShadow({mode:"open"}),i=(ae=ws(e.brandColor))!=null?ae:"#2563eb",r=et(i,.35),a=et(i,.45);t.style.setProperty("--lc-brand",i),t.style.setProperty("--lc-brand-shadow",r),t.style.setProperty("--lc-brand-shadow-hover",a),e.position==="bottom-left"&&t.classList.add("lc-position-left");const c=document.createElement("style");c.textContent=cs,n.appendChild(c);const o={open:!1,sessionId:bs(),messages:vs(),socket:null,panel:null,askedForEmail:!1,unread:0,sessionClosed:!1,host:t},g=document.createElement("button");g.className="lc-bubble",g.innerHTML=Bs(),n.appendChild(g);const h=document.createElement("span");h.className="lc-unread",h.style.display="none",g.appendChild(h),o.messages.length===0&&e.welcomeMessage&&(o.messages.push({id:"welcome",role:"agent",content:e.welcomeMessage,createdAt:new Date().toISOString()}),re(o.messages));const d=us(n,s,o,N,e);d.style.display="none",o.panel=d;const k=()=>window.innerWidth<=480,C="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;";function $(){const E=window.visualViewport;E?t.style.cssText=`position: fixed; top: ${E.offsetTop}px; left: ${E.offsetLeft}px; width: ${E.width}px; height: ${E.height}px; z-index: 2147483646;`:t.style.cssText="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483646;"}let M=!1;function U(){if(M||!window.visualViewport)return;M=!0;const E=()=>{o.open&&(k()?$():t.style.cssText=C)};window.visualViewport.addEventListener("resize",E),window.visualViewport.addEventListener("scroll",E)}g.addEventListener("click",()=>{if(o.open=!o.open,o.open){k()&&($(),U()),d.classList.remove("lc-panel--closing"),d.style.display="flex",o.unread=0,h.style.display="none";const E=d.querySelector("textarea");E==null||E.focus(),Qe(d)}else d.classList.add("lc-panel--closing"),setTimeout(()=>{o.open||(d.style.display="none",k()&&(t.style.cssText=C)),d.classList.remove("lc-panel--closing")},180)}),o.sessionId&&Xe(s,o,N);function N(){fs(d,o),!o.open&&o.unread>0?(h.textContent=String(Math.min(o.unread,99)),h.style.display="flex"):h.style.display="none"}N()}function us(s,e,t,n,i){const r=document.createElement("div");r.className="lc-panel",r.innerHTML=`
    <div class="lc-header">
      <div class="lc-header-inner">
        <div class="lc-header-avatar">${Rs()}</div>
        <div class="lc-header-text">
          <div class="lc-header-title">${I(i.operatorName||i.botName)}</div>
          <div class="lc-header-sub"><span class="lc-online-dot"></span>${I(i.botSubtitle)}</div>
        </div>
      </div>
      <button class="lc-close" aria-label="Close">${tt()}</button>
    </div>
    <div class="lc-messages-wrap">
      <div class="lc-messages"></div>
      <button class="lc-scroll-btn" type="button" style="display:none;" aria-label="Scroll to latest">${tt()} New messages</button>
    </div>
    <div class="lc-quick-replies" style="display:none;"></div>
    <div class="lc-toast" role="alert" style="display:none;"></div>
    <div class="lc-identify" style="display:none;">
      <div class="lc-identify-label">Share your details so we can follow up if needed.</div>
      <div class="lc-identify-row">
        <input class="lc-identify-name" type="text" placeholder="Your name" />
      </div>
      <div class="lc-identify-row">
        <input type="email" placeholder="your@email.com" />
        <button>Save</button>
      </div>
      <button class="lc-identify-skip">Skip</button>
    </div>
    <div class="lc-pending" style="display:none;"></div>
    <div class="lc-session-end" style="display:none;">
      <span>This conversation has ended.</span>
      <button type="button" class="lc-session-end-btn">Start new chat</button>
    </div>
    <form class="lc-composer" autocomplete="off">
      <input class="lc-hp" name="website" tabindex="-1" autocomplete="off" />
      <input class="lc-file-input" type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" style="display:none;" />
      <button type="button" class="lc-attach-btn" aria-label="Attach file">${As()}</button>
      <textarea placeholder="Type your message…" rows="1"></textarea>
      <button type="submit" aria-label="Send">${Is()}</button>
    </form>
  `,s.appendChild(r);const a="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;";r.querySelector(".lc-close").addEventListener("click",()=>{t.open=!1,r.classList.add("lc-panel--closing"),setTimeout(()=>{t.open||(r.style.display="none",window.innerWidth<=480&&(t.host.style.cssText=a)),r.classList.remove("lc-panel--closing")},180)});const o=r.querySelector(".lc-messages"),g=r.querySelector(".lc-scroll-btn");o.addEventListener("scroll",()=>{const l=o.scrollHeight-o.scrollTop-o.clientHeight;g.style.display=l>120?"flex":"none"}),g.addEventListener("click",()=>{o.scrollTop=o.scrollHeight,g.style.display="none"});const h=r.querySelector(".lc-composer"),d=r.querySelector("textarea"),k=r.querySelector(".lc-hp"),C=r.querySelector('.lc-composer button[type="submit"]'),$=r.querySelector(".lc-attach-btn"),M=r.querySelector(".lc-file-input"),U=r.querySelector(".lc-pending"),N=r.querySelector(".lc-quick-replies"),ae=r.querySelector(".lc-session-end"),E=r.querySelector(".lc-session-end-btn");function zs(){var l;(l=t.socket)==null||l.disconnect(),t.socket=null,t.sessionId=null,t.sessionClosed=!1,t.messages=[],t.askedForEmail=!1,t.unread=0;try{localStorage.removeItem(Ee)}catch(f){}try{localStorage.removeItem(ke)}catch(f){}try{localStorage.removeItem(ne)}catch(f){}ae.style.display="none",d.disabled=!1,C.disabled=!1,$.disabled=!1,i!=null&&i.welcomeMessage&&(t.messages.push({id:"welcome",role:"agent",content:i.welcomeMessage,createdAt:new Date().toISOString()}),re(t.messages)),n()}E.addEventListener("click",zs);const v=[],Fs=Date.now();let Te=!1;d.addEventListener("keydown",()=>{Te=!0}),d.addEventListener("input",()=>{Te=!0});const ot=()=>{var y;const l=t.messages.some(x=>x.role==="visitor"),f=((y=i.welcomeQuickReplies)!=null?y:[]).filter(Boolean);if(l||f.length===0){N.style.display="none",N.innerHTML="";return}N.style.display="flex",N.innerHTML=f.map((x,m)=>`<button data-i="${m}" type="button">${I(x)}</button>`).join(""),N.querySelectorAll("button").forEach(x=>{x.addEventListener("click",()=>{const m=Number(x.dataset.i),u=f[m];u&&(d.value=u,h.requestSubmit())})})};$.addEventListener("click",()=>M.click()),M.addEventListener("change",async()=>{var x;const l=(x=M.files)==null?void 0:x[0];if(M.value="",!l)return;if(l.size>10*1024*1024){O(r,`File too large: ${l.name} (max 10 MB)`);return}if(v.length>=5){O(r,"You can attach up to 5 files per message.");return}if(!t.sessionId){O(r,"Send a message first, then attach files.");return}const f=l.type.startsWith("image/")?URL.createObjectURL(l):void 0,y={id:"pending-"+Date.now(),mimeType:l.type,sizeBytes:l.size,originalFilename:l.name,url:"",localUrl:f};v.push(y),P();try{const m=await w(e,t.sessionId,l),u=v.indexOf(y);u>=0&&(v[u]=Be(ce({},m),{localUrl:f})),P()}catch(m){const u=v.indexOf(y);u>=0&&v.splice(u,1),f&&URL.revokeObjectURL(f),O(r,`Upload failed: ${m.message}`),P()}});function P(){if(!v.length){U.style.display="none",U.innerHTML="";return}U.style.display="flex",U.innerHTML=v.map((l,f)=>{var D;const y=l.id.startsWith("pending-"),x=(D=l.localUrl)!=null?D:"",u=l.mimeType.startsWith("image/")&&x?`<img class="lc-chip-thumb" src="${I(x)}" alt="">`:"",B=y?`${u}<span class="lc-chip-label lc-chip-uploading">Uploading…</span>`:`${u}<span class="lc-chip-label">${I(l.originalFilename)}</span><button data-i="${f}" aria-label="Remove">×</button>`;return`<span class="lc-chip${y?" lc-chip--busy":""}">${B}</span>`}).join(""),U.querySelectorAll("button[data-i]").forEach(l=>{l.addEventListener("click",()=>{const f=Number(l.dataset.i),y=v.splice(f,1)[0];y!=null&&y.localUrl&&URL.revokeObjectURL(y.localUrl),P()})})}let Ae=null,at=!1;const W=l=>{var f;at!==l&&(at=l,(f=t.socket)==null||f.emit("livechat:typing",{on:l}))};d.addEventListener("input",()=>{d.style.height="auto",d.style.height=Math.min(120,d.scrollHeight)+"px",d.value.trim()?(W(!0),Ae&&clearTimeout(Ae),Ae=setTimeout(()=>W(!1),1500)):W(!1)}),d.addEventListener("blur",()=>W(!1)),d.addEventListener("keydown",l=>{l.key==="Enter"&&!l.shiftKey&&(l.preventDefault(),h.requestSubmit())}),d.addEventListener("paste",async l=>{var x;const f=(x=l.clipboardData)==null?void 0:x.items;if(!f)return;const y=[];for(const m of f)if(m.kind==="file"&&m.type.startsWith("image/")){const u=m.getAsFile();u&&y.push(u)}if(y.length){if(l.preventDefault(),!t.sessionId){O(r,"Send a message first, then paste images.");return}for(const m of y){if(m.size>10*1024*1024){O(r,`Pasted image too large: ${m.name||"image"} (max 10 MB)`);continue}if(v.length>=5)break;const u=m.name?m:new File([m],`pasted-${Date.now()}.png`,{type:m.type}),B=URL.createObjectURL(u),D={id:"pending-"+Math.random().toString(36).slice(2),mimeType:m.type,sizeBytes:m.size,originalFilename:u.name,url:"",localUrl:B};v.push(D),P();try{const Oe=await w(e,t.sessionId,u),Y=v.indexOf(D);Y>=0&&(v[Y]=Be(ce({},Oe),{localUrl:B})),P()}catch(Oe){const Y=v.indexOf(D);Y>=0&&v.splice(Y,1),URL.revokeObjectURL(B),O(r,`Upload failed: ${Oe.message}`),P()}}}}),h.addEventListener("submit",async l=>{var m;if(l.preventDefault(),k.value)return;if(t.sessionClosed){O(r,"This conversation has ended. Start a new chat below.");return}const f=d.value.trim(),y=v.some(u=>u.id.startsWith("pending-")),x=v.filter(u=>u.url&&!u.id.startsWith("pending-"));if(y&&!f){O(r,"Your file is still uploading — please wait or add a message.");return}if(!(!f&&!x.length)){if(!ys()){O(r,"Slow down — too many messages in the last minute.");return}C.disabled=!0,d.value="",d.style.height="auto",W(!1),ms(t,f,x),v.length=0,P(),ot(),n(),Ge(r);try{const u=await pt(e,f,x.map(B=>B.id),{hp:k.value||void 0,elapsedMs:Date.now()-Fs,hadInteraction:Te});if(ie(r),t.sessionId=u.sessionId,xs(u.sessionId),"content"in u.agent&&u.agent.content){const B=(m=u.agent.id)!=null?m:"";t.messages.some(D=>D.id===B&&B)||Ze(t,u.agent.content,B)}t.socket||Xe(e,t,n,i),gs(r,t)}catch(u){ie(r),O(r,"Could not send — please try again.")}C.disabled=!1,n()}});const F=r.querySelector(".lc-identify"),Hs=F.querySelector(".lc-identify-name"),Vs=F.querySelector('input[type="email"]'),Ks=F.querySelectorAll("button")[0],js=F.querySelectorAll("button")[1];return Ks.addEventListener("click",async()=>{const l=Vs.value.trim(),f=Hs.value.trim()||void 0;if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l))try{await ut(e,{email:l,name:f}),F.style.display="none";try{localStorage.setItem(ne,"saved")}catch(y){}}catch(y){}}),js.addEventListener("click",()=>{F.style.display="none";try{localStorage.setItem(ne,"skipped")}catch(l){}}),ot(),r}function Xe(s,e,t,n){!e.sessionId||e.socket||(e.socket=as(s,e.sessionId,i=>{var a,c,o,g;if(i.type==="typing"){const h=e.panel;if(!h)return;i.on?Ge(h):ie(h);return}if(i.type==="session_status"&&i.status==="closed"){(a=e.socket)==null||a.disconnect(),e.socket=null,e.sessionClosed=!0;const h=e.panel;if(h){const d=h.querySelector(".lc-session-end"),k=h.querySelector("textarea"),C=h.querySelector('.lc-composer button[type="submit"]'),$=h.querySelector(".lc-attach-btn");d&&(d.style.display="flex"),k&&(k.disabled=!0),C&&(C.disabled=!0),$&&($.disabled=!0)}t();return}if(i.type!=="message"||!i.messageId||i.role==="visitor"||e.messages.some(h=>h.id===i.messageId))return;Ze(e,(c=i.content)!=null?c:"",i.messageId,i.role==="operator",i.attachments,(o=i.operatorName)!=null?o:void 0);const r=e.panel;r&&ie(r),e.open||(e.unread=((g=e.unread)!=null?g:0)+1),t()}))}function fs(s,e){const t=s.querySelector(".lc-messages");if(t){if(e.messages.length===0){t.innerHTML='<div class="lc-empty">Send us a message — we will get right back to you.</div>';return}t.innerHTML=e.messages.map(n=>{var g;const i=n.content?ks(n.content):"",r=((g=n.attachments)!=null?g:[]).map(_s).join(""),a=r?`<div class="lc-attachments">${r}</div>`:"",c=Ts(n.createdAt),o=c?`<div class="lc-msg-time">${c}</div>`:"";if(n.role==="system")return`<div class="lc-msg lc-msg-system">${i}</div>`;if(n.role==="visitor")return`<div class="lc-msg-row lc-msg-row-visitor">
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-visitor">${i}${a}</div>
            ${o}
          </div>
        </div>`;if(n.role==="operator"&&n.operatorName){const h=Ss(n.operatorName);return`<div class="lc-msg-row lc-msg-row-agent">
          <div class="lc-msg-avatar lc-msg-avatar-op" title="${I(n.operatorName)}">${I(h)}</div>
          <div class="lc-msg-body">
            <div class="lc-msg-sender">${I(n.operatorName)}</div>
            <div class="lc-msg lc-msg-agent">${i}${a}</div>
            ${o}
          </div>
        </div>`}return`<div class="lc-msg-row lc-msg-row-agent">
        <div class="lc-msg-avatar">${Ls()}</div>
        <div class="lc-msg-body">
          <div class="lc-msg lc-msg-agent">${i}${a}</div>
          ${o}
        </div>
      </div>`}).join(""),Qe(s)}}function Qe(s){const e=s.querySelector(".lc-messages");e&&(e.scrollTop=e.scrollHeight)}function Ge(s){const e=s.querySelector(".lc-messages");if(!e||e.querySelector(".lc-typing"))return;const t=document.createElement("div");t.className="lc-typing",t.innerHTML="<span></span><span></span><span></span>",e.appendChild(t),e.scrollTop=e.scrollHeight}function ie(s){s.querySelectorAll(".lc-typing").forEach(e=>e.remove())}function gs(s,e){if(e.askedForEmail)return;try{if(localStorage.getItem(ne))return}catch(n){}if(e.messages.filter(n=>n.role==="agent").length<1)return;e.askedForEmail=!0;const t=s.querySelector(".lc-identify");t&&(t.style.display="block")}function ms(s,e,t){s.messages.push({id:"local-"+Date.now(),role:"visitor",content:e,createdAt:new Date().toISOString(),attachments:t}),re(s.messages)}function Ze(s,e,t,n=!1,i,r){s.messages.push({id:t||"srv-"+Date.now(),role:n?"operator":"agent",content:e,createdAt:new Date().toISOString(),attachments:i,operatorName:r}),re(s.messages)}function ys(){var s;try{const e=Date.now(),t=JSON.parse((s=localStorage.getItem(Je))!=null?s:"[]").filter(n=>e-n<ds);return t.length>=hs?!1:(t.push(e),localStorage.setItem(Je,JSON.stringify(t)),!0)}catch(e){return!0}}function bs(){try{return localStorage.getItem(Ee)}catch(s){return null}}function xs(s){try{localStorage.setItem(Ee,s)}catch(e){}}function vs(){try{const s=localStorage.getItem(ke);return s?JSON.parse(s):[]}catch(s){return[]}}function re(s){try{localStorage.setItem(ke,JSON.stringify(s.slice(-50)))}catch(e){}}function I(s){return s.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function ws(s){if(!s)return null;const e=s.trim();return/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(e)?e:null}function et(s,e){let t=s.replace("#","");t.length===3&&(t=t.split("").map(a=>a+a).join(""));const n=parseInt(t.slice(0,2),16),i=parseInt(t.slice(2,4),16),r=parseInt(t.slice(4,6),16);return`rgba(${n}, ${i}, ${r}, ${e})`}function _s(s){if(s.mimeType.startsWith("image/")&&s.url)return`<a href="${K(s.url)}" target="_blank" rel="noopener noreferrer"><img class="lc-attach-img" src="${K(s.url)}" alt="${K(s.originalFilename)}" /></a>`;const t=Es(s.sizeBytes);return`<a class="lc-attach-file" href="${s.url?K(s.url):"#"}" target="_blank" rel="noopener noreferrer">${Os()}<span>${I(s.originalFilename)}</span><span class="lc-attach-size">${t}</span></a>`}function ks(s){return I(s).replace(/(https?:\/\/[^\s<]+)/g,t=>{const n=t.match(/[.,;:!?)]+$/),i=n?n[0]:"",r=i?t.slice(0,-i.length):t;return`<a href="${K(r)}" target="_blank" rel="noopener noreferrer nofollow">${r}</a>${i}`})}function K(s){return s.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function Es(s){return s<1024?`${s} B`:s<1024*1024?`${(s/1024).toFixed(0)} KB`:`${(s/1024/1024).toFixed(1)} MB`}function O(s,e,t=3500){const n=s.querySelector(".lc-toast");n&&(n.textContent=e,n.style.display="block",clearTimeout(n._timer),n._timer=setTimeout(()=>{n.style.display="none"},t))}function Ss(s){return s.trim().split(/\s+/).map(e=>{var t;return(t=e[0])!=null?t:""}).join("").slice(0,2).toUpperCase()}function Ts(s){try{const e=new Date(s);return isNaN(e.getTime())?"":e.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}catch(e){return""}}function As(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.58 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48"/></svg>'}function Os(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'}function Bs(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'}function Rs(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'}function Ls(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'}function tt(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'}function Is(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'}let st="",j=null,oe=null;const Cs=3e4;function Ns(s){nt(s),$s(s),window.addEventListener("popstate",()=>Se(s)),window.addEventListener("pagehide",()=>{j&&Re(s,j)}),qs(s)}function qs(s){const e=()=>{document.visibilityState==="visible"&&dt(s,{url:location.href,title:document.title})};setInterval(e,Cs),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&e()})}function $s(s){const e={pushState:history.pushState,replaceState:history.replaceState};history.pushState=function(...t){const n=e.pushState.apply(this,t);return Se(s),n},history.replaceState=function(...t){const n=e.replaceState.apply(this,t);return Se(s),n}}function Se(s){oe&&clearTimeout(oe),oe=setTimeout(()=>nt(s),300)}async function nt(s){var t;oe=null;const e=location.pathname+location.search;if(e!==st){st=e,j&&Re(s,j);try{j=(t=(await ht(s,{url:location.href,path:location.pathname,title:document.title,referrer:document.referrer,language:navigator.language})).pageviewId)!=null?t:null}catch(n){}}}const it="livechat_visitor_id";function Ps(){const s=Ds();if(!s)return null;const e=s.getAttribute("data-site");if(!e)return null;const t=s.getAttribute("data-api")||Ms(s)||"",n=Us();return{siteKey:e,visitorId:n,apiBase:t}}function Ds(){const s=document.querySelectorAll("script[data-site]");return s.length?s[s.length-1]:null}function Ms(s){if(!s.src)return null;try{const e=new URL(s.src);return`${e.protocol}//${e.host}`}catch(e){return null}}function Us(){try{const s=localStorage.getItem(it);if(s)return s;const e=rt();return localStorage.setItem(it,e),e}catch(s){return rt()}}function rt(){if(typeof crypto!="undefined"&&crypto.randomUUID)return crypto.randomUUID();let s=Date.now();return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,e=>{const t=(s+Math.random()*16)%16|0;return s=Math.floor(s/16),(e==="x"?t:t&3|8).toString(16)})}(function(){var n;if(typeof window=="undefined"||(n=window.__livechat__)!=null&&n.mounted)return;const e=Ps();if(!e)return;window.__livechat__={mounted:!0,siteKey:e.siteKey,visitorId:e.visitorId},Ns(e);const t=async()=>{const i=await T(e);ps(e,i!=null?i:void 0)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",t):t()})()})();
