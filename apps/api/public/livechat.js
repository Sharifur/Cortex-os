var zi=Object.defineProperty,Hi=Object.defineProperties;var Fi=Object.getOwnPropertyDescriptors;var Wt=Object.getOwnPropertySymbols;var Vi=Object.prototype.hasOwnProperty,Ki=Object.prototype.propertyIsEnumerable;var Jt=(K,D,j)=>D in K?zi(K,D,{enumerable:!0,configurable:!0,writable:!0,value:j}):K[D]=j,ee=(K,D)=>{for(var j in D||(D={}))Vi.call(D,j)&&Jt(K,j,D[j]);if(Wt)for(var j of Wt(D))Ki.call(D,j)&&Jt(K,j,D[j]);return K},le=(K,D)=>Hi(K,Fi(D));(function(){"use strict";async function K(n){try{const e=await fetch(`${n.apiBase}/livechat/config?siteKey=${encodeURIComponent(n.siteKey)}`,{method:"GET",credentials:"omit"});return e.ok?await e.json():null}catch(e){return null}}async function D(n,e,t){const i=new FormData;i.append("siteKey",n.siteKey),i.append("visitorId",n.visitorId),i.append("sessionId",e),i.append("file",t,t.name);const s=await fetch(`${n.apiBase}/livechat/upload`,{method:"POST",body:i,credentials:"omit"});if(!s.ok){const r=await s.text().catch(()=>"");throw new Error(`${s.status} ${s.statusText}${r?` — ${r}`:""}`)}return s.json()}async function j(n,e){const t=await fetch(n,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e),credentials:"omit"});if(!t.ok){const i=await t.text().catch(()=>"");throw new Error(`${t.status} ${t.statusText}${i?` — ${i}`:""}`)}return t.json()}function Xt(n,e){return j(`${n.apiBase}/livechat/track/pageview`,ee({siteKey:n.siteKey,visitorId:n.visitorId},e))}function Gt(n,e){return j(`${n.apiBase}/livechat/track/heartbeat`,{siteKey:n.siteKey,visitorId:n.visitorId,url:e.url,title:e.title}).catch(()=>{})}function nt(n,e){const t=`${n.apiBase}/livechat/track/leave`,i=JSON.stringify({siteKey:n.siteKey,visitorId:n.visitorId,pageviewId:e});if(navigator.sendBeacon){const s=new Blob([i],{type:"application/json"});navigator.sendBeacon(t,s);return}fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:i,keepalive:!0}).catch(()=>{})}function Qt(n,e,t,i,s,r,o){return j(`${n.apiBase}/livechat/message`,{siteKey:n.siteKey,visitorId:n.visitorId,content:e,attachmentIds:t&&t.length?t:void 0,meta:i,pageContext:s,replyToId:void 0,replyToContent:void 0})}function it(n,e){return j(`${n.apiBase}/livechat/identify`,{siteKey:n.siteKey,visitorId:n.visitorId,email:e.email,name:e.name})}const W=Object.create(null);W.open="0",W.close="1",W.ping="2",W.pong="3",W.message="4",W.upgrade="5",W.noop="6";const be=Object.create(null);Object.keys(W).forEach(n=>{be[W[n]]=n});const $e={type:"error",data:"parser error"},st=typeof Blob=="function"||typeof Blob!="undefined"&&Object.prototype.toString.call(Blob)==="[object BlobConstructor]",rt=typeof ArrayBuffer=="function",ot=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n&&n.buffer instanceof ArrayBuffer,Be=({type:n,data:e},t,i)=>st&&e instanceof Blob?t?i(e):at(e,i):rt&&(e instanceof ArrayBuffer||ot(e))?t?i(e):at(new Blob([e]),i):i(W[n]+(e||"")),at=(n,e)=>{const t=new FileReader;return t.onload=function(){const i=t.result.split(",")[1];e("b"+(i||""))},t.readAsDataURL(n)};function ct(n){return n instanceof Uint8Array?n:n instanceof ArrayBuffer?new Uint8Array(n):new Uint8Array(n.buffer,n.byteOffset,n.byteLength)}let Ne;function Zt(n,e){if(st&&n.data instanceof Blob)return n.data.arrayBuffer().then(ct).then(e);if(rt&&(n.data instanceof ArrayBuffer||ot(n.data)))return e(ct(n.data));Be(n,!1,t=>{Ne||(Ne=new TextEncoder),e(Ne.encode(t))})}const lt="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",de=typeof Uint8Array=="undefined"?[]:new Uint8Array(256);for(let n=0;n<lt.length;n++)de[lt.charCodeAt(n)]=n;const en=n=>{let e=n.length*.75,t=n.length,i,s=0,r,o,c,l;n[n.length-1]==="="&&(e--,n[n.length-2]==="="&&e--);const b=new ArrayBuffer(e),k=new Uint8Array(b);for(i=0;i<t;i+=4)r=de[n.charCodeAt(i)],o=de[n.charCodeAt(i+1)],c=de[n.charCodeAt(i+2)],l=de[n.charCodeAt(i+3)],k[s++]=r<<2|o>>4,k[s++]=(o&15)<<4|c>>2,k[s++]=(c&3)<<6|l&63;return b},tn=typeof ArrayBuffer=="function",qe=(n,e)=>{if(typeof n!="string")return{type:"message",data:dt(n,e)};const t=n.charAt(0);return t==="b"?{type:"message",data:nn(n.substring(1),e)}:be[t]?n.length>1?{type:be[t],data:n.substring(1)}:{type:be[t]}:$e},nn=(n,e)=>{if(tn){const t=en(n);return dt(t,e)}else return{base64:!0,data:n}},dt=(n,e)=>{switch(e){case"blob":return n instanceof Blob?n:new Blob([n]);case"arraybuffer":default:return n instanceof ArrayBuffer?n:n.buffer}},ht="",sn=(n,e)=>{const t=n.length,i=new Array(t);let s=0;n.forEach((r,o)=>{Be(r,!1,c=>{i[o]=c,++s===t&&e(i.join(ht))})})},rn=(n,e)=>{const t=n.split(ht),i=[];for(let s=0;s<t.length;s++){const r=qe(t[s],e);if(i.push(r),r.type==="error")break}return i};function on(){return new TransformStream({transform(n,e){Zt(n,t=>{const i=t.length;let s;if(i<126)s=new Uint8Array(1),new DataView(s.buffer).setUint8(0,i);else if(i<65536){s=new Uint8Array(3);const r=new DataView(s.buffer);r.setUint8(0,126),r.setUint16(1,i)}else{s=new Uint8Array(9);const r=new DataView(s.buffer);r.setUint8(0,127),r.setBigUint64(1,BigInt(i))}n.data&&typeof n.data!="string"&&(s[0]|=128),e.enqueue(s),e.enqueue(t)})}})}let Pe;function xe(n){return n.reduce((e,t)=>e+t.length,0)}function ve(n,e){if(n[0].length===e)return n.shift();const t=new Uint8Array(e);let i=0;for(let s=0;s<e;s++)t[s]=n[0][i++],i===n[0].length&&(n.shift(),i=0);return n.length&&i<n[0].length&&(n[0]=n[0].slice(i)),t}function an(n,e){Pe||(Pe=new TextDecoder);const t=[];let i=0,s=-1,r=!1;return new TransformStream({transform(o,c){for(t.push(o);;){if(i===0){if(xe(t)<1)break;const l=ve(t,1);r=(l[0]&128)===128,s=l[0]&127,s<126?i=3:s===126?i=1:i=2}else if(i===1){if(xe(t)<2)break;const l=ve(t,2);s=new DataView(l.buffer,l.byteOffset,l.length).getUint16(0),i=3}else if(i===2){if(xe(t)<8)break;const l=ve(t,8),b=new DataView(l.buffer,l.byteOffset,l.length),k=b.getUint32(0);if(k>Math.pow(2,21)-1){c.enqueue($e);break}s=k*Math.pow(2,32)+b.getUint32(4),i=3}else{if(xe(t)<s)break;const l=ve(t,s);c.enqueue(qe(r?l:Pe.decode(l),e)),i=0}if(s===0||s>n){c.enqueue($e);break}}}})}const pt=4;function C(n){if(n)return cn(n)}function cn(n){for(var e in C.prototype)n[e]=C.prototype[e];return n}C.prototype.on=C.prototype.addEventListener=function(n,e){return this._callbacks=this._callbacks||{},(this._callbacks["$"+n]=this._callbacks["$"+n]||[]).push(e),this},C.prototype.once=function(n,e){function t(){this.off(n,t),e.apply(this,arguments)}return t.fn=e,this.on(n,t),this},C.prototype.off=C.prototype.removeListener=C.prototype.removeAllListeners=C.prototype.removeEventListener=function(n,e){if(this._callbacks=this._callbacks||{},arguments.length==0)return this._callbacks={},this;var t=this._callbacks["$"+n];if(!t)return this;if(arguments.length==1)return delete this._callbacks["$"+n],this;for(var i,s=0;s<t.length;s++)if(i=t[s],i===e||i.fn===e){t.splice(s,1);break}return t.length===0&&delete this._callbacks["$"+n],this},C.prototype.emit=function(n){this._callbacks=this._callbacks||{};for(var e=new Array(arguments.length-1),t=this._callbacks["$"+n],i=1;i<arguments.length;i++)e[i-1]=arguments[i];if(t){t=t.slice(0);for(var i=0,s=t.length;i<s;++i)t[i].apply(this,e)}return this},C.prototype.emitReserved=C.prototype.emit,C.prototype.listeners=function(n){return this._callbacks=this._callbacks||{},this._callbacks["$"+n]||[]},C.prototype.hasListeners=function(n){return!!this.listeners(n).length};const we=typeof Promise=="function"&&typeof Promise.resolve=="function"?e=>Promise.resolve().then(e):(e,t)=>t(e,0),z=typeof self!="undefined"?self:typeof window!="undefined"?window:Function("return this")(),ln="arraybuffer";function Yi(){}function ut(n,...e){return e.reduce((t,i)=>(n.hasOwnProperty(i)&&(t[i]=n[i]),t),{})}const dn=z.setTimeout,hn=z.clearTimeout;function _e(n,e){e.useNativeTimers?(n.setTimeoutFn=dn.bind(z),n.clearTimeoutFn=hn.bind(z)):(n.setTimeoutFn=z.setTimeout.bind(z),n.clearTimeoutFn=z.clearTimeout.bind(z))}const pn=1.33;function un(n){return typeof n=="string"?fn(n):Math.ceil((n.byteLength||n.size)*pn)}function fn(n){let e=0,t=0;for(let i=0,s=n.length;i<s;i++)e=n.charCodeAt(i),e<128?t+=1:e<2048?t+=2:e<55296||e>=57344?t+=3:(i++,t+=4);return t}function ft(){return Date.now().toString(36).substring(3)+Math.random().toString(36).substring(2,5)}function mn(n){let e="";for(let t in n)n.hasOwnProperty(t)&&(e.length&&(e+="&"),e+=encodeURIComponent(t)+"="+encodeURIComponent(n[t]));return e}function gn(n){let e={},t=n.split("&");for(let i=0,s=t.length;i<s;i++){let r=t[i].split("=");e[decodeURIComponent(r[0])]=decodeURIComponent(r[1])}return e}class yn extends Error{constructor(e,t,i){super(e),this.description=t,this.context=i,this.type="TransportError"}}class Me extends C{constructor(e){super(),this.writable=!1,_e(this,e),this.opts=e,this.query=e.query,this.socket=e.socket,this.supportsBinary=!e.forceBase64}onError(e,t,i){return super.emitReserved("error",new yn(e,t,i)),this}open(){return this.readyState="opening",this.doOpen(),this}close(){return(this.readyState==="opening"||this.readyState==="open")&&(this.doClose(),this.onClose()),this}send(e){this.readyState==="open"&&this.write(e)}onOpen(){this.readyState="open",this.writable=!0,super.emitReserved("open")}onData(e){const t=qe(e,this.socket.binaryType);this.onPacket(t)}onPacket(e){super.emitReserved("packet",e)}onClose(e){this.readyState="closed",super.emitReserved("close",e)}pause(e){}createUri(e,t={}){return e+"://"+this._hostname()+this._port()+this.opts.path+this._query(t)}_hostname(){const e=this.opts.hostname;return e.indexOf(":")===-1?e:"["+e+"]"}_port(){return this.opts.port&&(this.opts.secure&&Number(this.opts.port)!==443||!this.opts.secure&&Number(this.opts.port)!==80)?":"+this.opts.port:""}_query(e){const t=mn(e);return t.length?"?"+t:""}}class bn extends Me{constructor(){super(...arguments),this._polling=!1}get name(){return"polling"}doOpen(){this._poll()}pause(e){this.readyState="pausing";const t=()=>{this.readyState="paused",e()};if(this._polling||!this.writable){let i=0;this._polling&&(i++,this.once("pollComplete",function(){--i||t()})),this.writable||(i++,this.once("drain",function(){--i||t()}))}else t()}_poll(){this._polling=!0,this.doPoll(),this.emitReserved("poll")}onData(e){const t=i=>{if(this.readyState==="opening"&&i.type==="open"&&this.onOpen(),i.type==="close")return this.onClose({description:"transport closed by the server"}),!1;this.onPacket(i)};rn(e,this.socket.binaryType).forEach(t),this.readyState!=="closed"&&(this._polling=!1,this.emitReserved("pollComplete"),this.readyState==="open"&&this._poll())}doClose(){const e=()=>{this.write([{type:"close"}])};this.readyState==="open"?e():this.once("open",e)}write(e){this.writable=!1,sn(e,t=>{this.doWrite(t,()=>{this.writable=!0,this.emitReserved("drain")})})}uri(){const e=this.opts.secure?"https":"http",t=this.query||{};return this.opts.timestampRequests!==!1&&(t[this.opts.timestampParam]=ft()),!this.supportsBinary&&!t.sid&&(t.b64=1),this.createUri(e,t)}}let mt=!1;try{mt=typeof XMLHttpRequest!="undefined"&&"withCredentials"in new XMLHttpRequest}catch(n){}const xn=mt;function vn(){}class wn extends bn{constructor(e){if(super(e),typeof location!="undefined"){const t=location.protocol==="https:";let i=location.port;i||(i=t?"443":"80"),this.xd=typeof location!="undefined"&&e.hostname!==location.hostname||i!==e.port}}doWrite(e,t){const i=this.request({method:"POST",data:e});i.on("success",t),i.on("error",(s,r)=>{this.onError("xhr post error",s,r)})}doPoll(){const e=this.request();e.on("data",this.onData.bind(this)),e.on("error",(t,i)=>{this.onError("xhr poll error",t,i)}),this.pollXhr=e}}class J extends C{constructor(e,t,i){super(),this.createRequest=e,_e(this,i),this._opts=i,this._method=i.method||"GET",this._uri=t,this._data=i.data!==void 0?i.data:null,this._create()}_create(){var e;const t=ut(this._opts,"agent","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","autoUnref");t.xdomain=!!this._opts.xd;const i=this._xhr=this.createRequest(t);try{i.open(this._method,this._uri,!0);try{if(this._opts.extraHeaders){i.setDisableHeaderCheck&&i.setDisableHeaderCheck(!0);for(let s in this._opts.extraHeaders)this._opts.extraHeaders.hasOwnProperty(s)&&i.setRequestHeader(s,this._opts.extraHeaders[s])}}catch(s){}if(this._method==="POST")try{i.setRequestHeader("Content-type","text/plain;charset=UTF-8")}catch(s){}try{i.setRequestHeader("Accept","*/*")}catch(s){}(e=this._opts.cookieJar)===null||e===void 0||e.addCookies(i),"withCredentials"in i&&(i.withCredentials=this._opts.withCredentials),this._opts.requestTimeout&&(i.timeout=this._opts.requestTimeout),i.onreadystatechange=()=>{var s;i.readyState===3&&((s=this._opts.cookieJar)===null||s===void 0||s.parseCookies(i.getResponseHeader("set-cookie"))),i.readyState===4&&(i.status===200||i.status===1223?this._onLoad():this.setTimeoutFn(()=>{this._onError(typeof i.status=="number"?i.status:0)},0))},i.send(this._data)}catch(s){this.setTimeoutFn(()=>{this._onError(s)},0);return}typeof document!="undefined"&&(this._index=J.requestsCount++,J.requests[this._index]=this)}_onError(e){this.emitReserved("error",e,this._xhr),this._cleanup(!0)}_cleanup(e){if(!(typeof this._xhr=="undefined"||this._xhr===null)){if(this._xhr.onreadystatechange=vn,e)try{this._xhr.abort()}catch(t){}typeof document!="undefined"&&delete J.requests[this._index],this._xhr=null}}_onLoad(){const e=this._xhr.responseText;e!==null&&(this.emitReserved("data",e),this.emitReserved("success"),this._cleanup())}abort(){this._cleanup()}}if(J.requestsCount=0,J.requests={},typeof document!="undefined"){if(typeof attachEvent=="function")attachEvent("onunload",gt);else if(typeof addEventListener=="function"){const n="onpagehide"in z?"pagehide":"unload";addEventListener(n,gt,!1)}}function gt(){for(let n in J.requests)J.requests.hasOwnProperty(n)&&J.requests[n].abort()}const _n=(function(){const n=yt({xdomain:!1});return n&&n.responseType!==null})();class kn extends wn{constructor(e){super(e);const t=e&&e.forceBase64;this.supportsBinary=_n&&!t}request(e={}){return Object.assign(e,{xd:this.xd},this.opts),new J(yt,this.uri(),e)}}function yt(n){const e=n.xdomain;try{if(typeof XMLHttpRequest!="undefined"&&(!e||xn))return new XMLHttpRequest}catch(t){}if(!e)try{return new z[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP")}catch(t){}}const bt=typeof navigator!="undefined"&&typeof navigator.product=="string"&&navigator.product.toLowerCase()==="reactnative";class Sn extends Me{get name(){return"websocket"}doOpen(){const e=this.uri(),t=this.opts.protocols,i=bt?{}:ut(this.opts,"agent","perMessageDeflate","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","localAddress","protocolVersion","origin","maxPayload","family","checkServerIdentity");this.opts.extraHeaders&&(i.headers=this.opts.extraHeaders);try{this.ws=this.createSocket(e,t,i)}catch(s){return this.emitReserved("error",s)}this.ws.binaryType=this.socket.binaryType,this.addEventListeners()}addEventListeners(){this.ws.onopen=()=>{this.opts.autoUnref&&this.ws._socket.unref(),this.onOpen()},this.ws.onclose=e=>this.onClose({description:"websocket connection closed",context:e}),this.ws.onmessage=e=>this.onData(e.data),this.ws.onerror=e=>this.onError("websocket error",e)}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const i=e[t],s=t===e.length-1;Be(i,this.supportsBinary,r=>{try{this.doWrite(i,r)}catch(o){}s&&we(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){typeof this.ws!="undefined"&&(this.ws.onerror=()=>{},this.ws.close(),this.ws=null)}uri(){const e=this.opts.secure?"wss":"ws",t=this.query||{};return this.opts.timestampRequests&&(t[this.opts.timestampParam]=ft()),this.supportsBinary||(t.b64=1),this.createUri(e,t)}}const De=z.WebSocket||z.MozWebSocket;class En extends Sn{createSocket(e,t,i){return bt?new De(e,t,i):t?new De(e,t):new De(e)}doWrite(e,t){this.ws.send(t)}}class Tn extends Me{get name(){return"webtransport"}doOpen(){try{this._transport=new WebTransport(this.createUri("https"),this.opts.transportOptions[this.name])}catch(e){return this.emitReserved("error",e)}this._transport.closed.then(()=>{this.onClose()}).catch(e=>{this.onError("webtransport error",e)}),this._transport.ready.then(()=>{this._transport.createBidirectionalStream().then(e=>{const t=an(Number.MAX_SAFE_INTEGER,this.socket.binaryType),i=e.readable.pipeThrough(t).getReader(),s=on();s.readable.pipeTo(e.writable),this._writer=s.writable.getWriter();const r=()=>{i.read().then(({done:c,value:l})=>{c||(this.onPacket(l),r())}).catch(c=>{})};r();const o={type:"open"};this.query.sid&&(o.data=`{"sid":"${this.query.sid}"}`),this._writer.write(o).then(()=>this.onOpen())})})}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const i=e[t],s=t===e.length-1;this._writer.write(i).then(()=>{s&&we(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){var e;(e=this._transport)===null||e===void 0||e.close()}}const In={websocket:En,webtransport:Tn,polling:kn},An=/^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,Ln=["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"];function je(n){if(n.length>8e3)throw"URI too long";const e=n,t=n.indexOf("["),i=n.indexOf("]");t!=-1&&i!=-1&&(n=n.substring(0,t)+n.substring(t,i).replace(/:/g,";")+n.substring(i,n.length));let s=An.exec(n||""),r={},o=14;for(;o--;)r[Ln[o]]=s[o]||"";return t!=-1&&i!=-1&&(r.source=e,r.host=r.host.substring(1,r.host.length-1).replace(/;/g,":"),r.authority=r.authority.replace("[","").replace("]","").replace(/;/g,":"),r.ipv6uri=!0),r.pathNames=On(r,r.path),r.queryKey=Cn(r,r.query),r}function On(n,e){const t=/\/{2,9}/g,i=e.replace(t,"/").split("/");return(e.slice(0,1)=="/"||e.length===0)&&i.splice(0,1),e.slice(-1)=="/"&&i.splice(i.length-1,1),i}function Cn(n,e){const t={};return e.replace(/(?:^|&)([^&=]*)=?([^&]*)/g,function(i,s,r){s&&(t[s]=r)}),t}const Ue=typeof addEventListener=="function"&&typeof removeEventListener=="function",ke=[];Ue&&addEventListener("offline",()=>{ke.forEach(n=>n())},!1);class te extends C{constructor(e,t){if(super(),this.binaryType=ln,this.writeBuffer=[],this._prevBufferLen=0,this._pingInterval=-1,this._pingTimeout=-1,this._maxPayload=-1,this._pingTimeoutTime=1/0,e&&typeof e=="object"&&(t=e,e=null),e){const i=je(e);t.hostname=i.host,t.secure=i.protocol==="https"||i.protocol==="wss",t.port=i.port,i.query&&(t.query=i.query)}else t.host&&(t.hostname=je(t.host).host);_e(this,t),this.secure=t.secure!=null?t.secure:typeof location!="undefined"&&location.protocol==="https:",t.hostname&&!t.port&&(t.port=this.secure?"443":"80"),this.hostname=t.hostname||(typeof location!="undefined"?location.hostname:"localhost"),this.port=t.port||(typeof location!="undefined"&&location.port?location.port:this.secure?"443":"80"),this.transports=[],this._transportsByName={},t.transports.forEach(i=>{const s=i.prototype.name;this.transports.push(s),this._transportsByName[s]=i}),this.opts=Object.assign({path:"/engine.io",agent:!1,withCredentials:!1,upgrade:!0,timestampParam:"t",rememberUpgrade:!1,addTrailingSlash:!0,rejectUnauthorized:!0,perMessageDeflate:{threshold:1024},transportOptions:{},closeOnBeforeunload:!1},t),this.opts.path=this.opts.path.replace(/\/$/,"")+(this.opts.addTrailingSlash?"/":""),typeof this.opts.query=="string"&&(this.opts.query=gn(this.opts.query)),Ue&&(this.opts.closeOnBeforeunload&&(this._beforeunloadEventListener=()=>{this.transport&&(this.transport.removeAllListeners(),this.transport.close())},addEventListener("beforeunload",this._beforeunloadEventListener,!1)),this.hostname!=="localhost"&&(this._offlineEventListener=()=>{this._onClose("transport close",{description:"network connection lost"})},ke.push(this._offlineEventListener))),this.opts.withCredentials&&(this._cookieJar=void 0),this._open()}createTransport(e){const t=Object.assign({},this.opts.query);t.EIO=pt,t.transport=e,this.id&&(t.sid=this.id);const i=Object.assign({},this.opts,{query:t,socket:this,hostname:this.hostname,secure:this.secure,port:this.port},this.opts.transportOptions[e]);return new this._transportsByName[e](i)}_open(){if(this.transports.length===0){this.setTimeoutFn(()=>{this.emitReserved("error","No transports available")},0);return}const e=this.opts.rememberUpgrade&&te.priorWebsocketSuccess&&this.transports.indexOf("websocket")!==-1?"websocket":this.transports[0];this.readyState="opening";const t=this.createTransport(e);t.open(),this.setTransport(t)}setTransport(e){this.transport&&this.transport.removeAllListeners(),this.transport=e,e.on("drain",this._onDrain.bind(this)).on("packet",this._onPacket.bind(this)).on("error",this._onError.bind(this)).on("close",t=>this._onClose("transport close",t))}onOpen(){this.readyState="open",te.priorWebsocketSuccess=this.transport.name==="websocket",this.emitReserved("open"),this.flush()}_onPacket(e){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing")switch(this.emitReserved("packet",e),this.emitReserved("heartbeat"),e.type){case"open":this.onHandshake(JSON.parse(e.data));break;case"ping":this._sendPacket("pong"),this.emitReserved("ping"),this.emitReserved("pong"),this._resetPingTimeout();break;case"error":const t=new Error("server error");t.code=e.data,this._onError(t);break;case"message":this.emitReserved("data",e.data),this.emitReserved("message",e.data);break}}onHandshake(e){this.emitReserved("handshake",e),this.id=e.sid,this.transport.query.sid=e.sid,this._pingInterval=e.pingInterval,this._pingTimeout=e.pingTimeout,this._maxPayload=e.maxPayload,this.onOpen(),this.readyState!=="closed"&&this._resetPingTimeout()}_resetPingTimeout(){this.clearTimeoutFn(this._pingTimeoutTimer);const e=this._pingInterval+this._pingTimeout;this._pingTimeoutTime=Date.now()+e,this._pingTimeoutTimer=this.setTimeoutFn(()=>{this._onClose("ping timeout")},e),this.opts.autoUnref&&this._pingTimeoutTimer.unref()}_onDrain(){this.writeBuffer.splice(0,this._prevBufferLen),this._prevBufferLen=0,this.writeBuffer.length===0?this.emitReserved("drain"):this.flush()}flush(){if(this.readyState!=="closed"&&this.transport.writable&&!this.upgrading&&this.writeBuffer.length){const e=this._getWritablePackets();this.transport.send(e),this._prevBufferLen=e.length,this.emitReserved("flush")}}_getWritablePackets(){if(!(this._maxPayload&&this.transport.name==="polling"&&this.writeBuffer.length>1))return this.writeBuffer;let t=1;for(let i=0;i<this.writeBuffer.length;i++){const s=this.writeBuffer[i].data;if(s&&(t+=un(s)),i>0&&t>this._maxPayload)return this.writeBuffer.slice(0,i);t+=2}return this.writeBuffer}_hasPingExpired(){if(!this._pingTimeoutTime)return!0;const e=Date.now()>this._pingTimeoutTime;return e&&(this._pingTimeoutTime=0,we(()=>{this._onClose("ping timeout")},this.setTimeoutFn)),e}write(e,t,i){return this._sendPacket("message",e,t,i),this}send(e,t,i){return this._sendPacket("message",e,t,i),this}_sendPacket(e,t,i,s){if(typeof t=="function"&&(s=t,t=void 0),typeof i=="function"&&(s=i,i=null),this.readyState==="closing"||this.readyState==="closed")return;i=i||{},i.compress=i.compress!==!1;const r={type:e,data:t,options:i};this.emitReserved("packetCreate",r),this.writeBuffer.push(r),s&&this.once("flush",s),this.flush()}close(){const e=()=>{this._onClose("forced close"),this.transport.close()},t=()=>{this.off("upgrade",t),this.off("upgradeError",t),e()},i=()=>{this.once("upgrade",t),this.once("upgradeError",t)};return(this.readyState==="opening"||this.readyState==="open")&&(this.readyState="closing",this.writeBuffer.length?this.once("drain",()=>{this.upgrading?i():e()}):this.upgrading?i():e()),this}_onError(e){if(te.priorWebsocketSuccess=!1,this.opts.tryAllTransports&&this.transports.length>1&&this.readyState==="opening")return this.transports.shift(),this._open();this.emitReserved("error",e),this._onClose("transport error",e)}_onClose(e,t){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing"){if(this.clearTimeoutFn(this._pingTimeoutTimer),this.transport.removeAllListeners("close"),this.transport.close(),this.transport.removeAllListeners(),Ue&&(this._beforeunloadEventListener&&removeEventListener("beforeunload",this._beforeunloadEventListener,!1),this._offlineEventListener)){const i=ke.indexOf(this._offlineEventListener);i!==-1&&ke.splice(i,1)}this.readyState="closed",this.id=null,this.emitReserved("close",e,t),this.writeBuffer=[],this._prevBufferLen=0}}}te.protocol=pt;class Rn extends te{constructor(){super(...arguments),this._upgrades=[]}onOpen(){if(super.onOpen(),this.readyState==="open"&&this.opts.upgrade)for(let e=0;e<this._upgrades.length;e++)this._probe(this._upgrades[e])}_probe(e){let t=this.createTransport(e),i=!1;te.priorWebsocketSuccess=!1;const s=()=>{i||(t.send([{type:"ping",data:"probe"}]),t.once("packet",O=>{if(!i)if(O.type==="pong"&&O.data==="probe"){if(this.upgrading=!0,this.emitReserved("upgrading",t),!t)return;te.priorWebsocketSuccess=t.name==="websocket",this.transport.pause(()=>{i||this.readyState!=="closed"&&(k(),this.setTransport(t),t.send([{type:"upgrade"}]),this.emitReserved("upgrade",t),t=null,this.upgrading=!1,this.flush())})}else{const v=new Error("probe error");v.transport=t.name,this.emitReserved("upgradeError",v)}}))};function r(){i||(i=!0,k(),t.close(),t=null)}const o=O=>{const v=new Error("probe error: "+O);v.transport=t.name,r(),this.emitReserved("upgradeError",v)};function c(){o("transport closed")}function l(){o("socket closed")}function b(O){t&&O.name!==t.name&&r()}const k=()=>{t.removeListener("open",s),t.removeListener("error",o),t.removeListener("close",c),this.off("close",l),this.off("upgrading",b)};t.once("open",s),t.once("error",o),t.once("close",c),this.once("close",l),this.once("upgrading",b),this._upgrades.indexOf("webtransport")!==-1&&e!=="webtransport"?this.setTimeoutFn(()=>{i||t.open()},200):t.open()}onHandshake(e){this._upgrades=this._filterUpgrades(e.upgrades),super.onHandshake(e)}_filterUpgrades(e){const t=[];for(let i=0;i<e.length;i++)~this.transports.indexOf(e[i])&&t.push(e[i]);return t}}let $n=class extends Rn{constructor(e,t={}){const i=typeof e=="object"?e:t;(!i.transports||i.transports&&typeof i.transports[0]=="string")&&(i.transports=(i.transports||["polling","websocket","webtransport"]).map(s=>In[s]).filter(s=>!!s)),super(e,i)}};function Bn(n,e="",t){let i=n;t=t||typeof location!="undefined"&&location,n==null&&(n=t.protocol+"//"+t.host),typeof n=="string"&&(n.charAt(0)==="/"&&(n.charAt(1)==="/"?n=t.protocol+n:n=t.host+n),/^(https?|wss?):\/\//.test(n)||(typeof t!="undefined"?n=t.protocol+"//"+n:n="https://"+n),i=je(n)),i.port||(/^(http|ws)$/.test(i.protocol)?i.port="80":/^(http|ws)s$/.test(i.protocol)&&(i.port="443")),i.path=i.path||"/";const r=i.host.indexOf(":")!==-1?"["+i.host+"]":i.host;return i.id=i.protocol+"://"+r+":"+i.port+e,i.href=i.protocol+"://"+r+(t&&t.port===i.port?"":":"+i.port),i}const Nn=typeof ArrayBuffer=="function",qn=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n.buffer instanceof ArrayBuffer,xt=Object.prototype.toString,Pn=typeof Blob=="function"||typeof Blob!="undefined"&&xt.call(Blob)==="[object BlobConstructor]",Mn=typeof File=="function"||typeof File!="undefined"&&xt.call(File)==="[object FileConstructor]";function ze(n){return Nn&&(n instanceof ArrayBuffer||qn(n))||Pn&&n instanceof Blob||Mn&&n instanceof File}function Se(n,e){if(!n||typeof n!="object")return!1;if(Array.isArray(n)){for(let t=0,i=n.length;t<i;t++)if(Se(n[t]))return!0;return!1}if(ze(n))return!0;if(n.toJSON&&typeof n.toJSON=="function"&&arguments.length===1)return Se(n.toJSON(),!0);for(const t in n)if(Object.prototype.hasOwnProperty.call(n,t)&&Se(n[t]))return!0;return!1}function Dn(n){const e=[],t=n.data,i=n;return i.data=He(t,e),i.attachments=e.length,{packet:i,buffers:e}}function He(n,e){if(!n)return n;if(ze(n)){const t={_placeholder:!0,num:e.length};return e.push(n),t}else if(Array.isArray(n)){const t=new Array(n.length);for(let i=0;i<n.length;i++)t[i]=He(n[i],e);return t}else if(typeof n=="object"&&!(n instanceof Date)){const t={};for(const i in n)Object.prototype.hasOwnProperty.call(n,i)&&(t[i]=He(n[i],e));return t}return n}function jn(n,e){return n.data=Fe(n.data,e),delete n.attachments,n}function Fe(n,e){if(!n)return n;if(n&&n._placeholder===!0){if(typeof n.num=="number"&&n.num>=0&&n.num<e.length)return e[n.num];throw new Error("illegal attachments")}else if(Array.isArray(n))for(let t=0;t<n.length;t++)n[t]=Fe(n[t],e);else if(typeof n=="object")for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&(n[t]=Fe(n[t],e));return n}const Un=["connect","connect_error","disconnect","disconnecting","newListener","removeListener"];var y;(function(n){n[n.CONNECT=0]="CONNECT",n[n.DISCONNECT=1]="DISCONNECT",n[n.EVENT=2]="EVENT",n[n.ACK=3]="ACK",n[n.CONNECT_ERROR=4]="CONNECT_ERROR",n[n.BINARY_EVENT=5]="BINARY_EVENT",n[n.BINARY_ACK=6]="BINARY_ACK"})(y||(y={}));class zn{constructor(e){this.replacer=e}encode(e){return(e.type===y.EVENT||e.type===y.ACK)&&Se(e)?this.encodeAsBinary({type:e.type===y.EVENT?y.BINARY_EVENT:y.BINARY_ACK,nsp:e.nsp,data:e.data,id:e.id}):[this.encodeAsString(e)]}encodeAsString(e){let t=""+e.type;return(e.type===y.BINARY_EVENT||e.type===y.BINARY_ACK)&&(t+=e.attachments+"-"),e.nsp&&e.nsp!=="/"&&(t+=e.nsp+","),e.id!=null&&(t+=e.id),e.data!=null&&(t+=JSON.stringify(e.data,this.replacer)),t}encodeAsBinary(e){const t=Dn(e),i=this.encodeAsString(t.packet),s=t.buffers;return s.unshift(i),s}}class Ve extends C{constructor(e){super(),this.opts=Object.assign({reviver:void 0,maxAttachments:10},typeof e=="function"?{reviver:e}:e)}add(e){let t;if(typeof e=="string"){if(this.reconstructor)throw new Error("got plaintext data when reconstructing a packet");t=this.decodeString(e);const i=t.type===y.BINARY_EVENT;i||t.type===y.BINARY_ACK?(t.type=i?y.EVENT:y.ACK,this.reconstructor=new Hn(t),t.attachments===0&&super.emitReserved("decoded",t)):super.emitReserved("decoded",t)}else if(ze(e)||e.base64)if(this.reconstructor)t=this.reconstructor.takeBinaryData(e),t&&(this.reconstructor=null,super.emitReserved("decoded",t));else throw new Error("got binary data when not reconstructing a packet");else throw new Error("Unknown type: "+e)}decodeString(e){let t=0;const i={type:Number(e.charAt(0))};if(y[i.type]===void 0)throw new Error("unknown packet type "+i.type);if(i.type===y.BINARY_EVENT||i.type===y.BINARY_ACK){const r=t+1;for(;e.charAt(++t)!=="-"&&t!=e.length;);const o=e.substring(r,t);if(o!=Number(o)||e.charAt(t)!=="-")throw new Error("Illegal attachments");const c=Number(o);if(!Fn(c)||c<0)throw new Error("Illegal attachments");if(c>this.opts.maxAttachments)throw new Error("too many attachments");i.attachments=c}if(e.charAt(t+1)==="/"){const r=t+1;for(;++t&&!(e.charAt(t)===","||t===e.length););i.nsp=e.substring(r,t)}else i.nsp="/";const s=e.charAt(t+1);if(s!==""&&Number(s)==s){const r=t+1;for(;++t;){const o=e.charAt(t);if(o==null||Number(o)!=o){--t;break}if(t===e.length)break}i.id=Number(e.substring(r,t+1))}if(e.charAt(++t)){const r=this.tryParse(e.substr(t));if(Ve.isPayloadValid(i.type,r))i.data=r;else throw new Error("invalid payload")}return i}tryParse(e){try{return JSON.parse(e,this.opts.reviver)}catch(t){return!1}}static isPayloadValid(e,t){switch(e){case y.CONNECT:return vt(t);case y.DISCONNECT:return t===void 0;case y.CONNECT_ERROR:return typeof t=="string"||vt(t);case y.EVENT:case y.BINARY_EVENT:return Array.isArray(t)&&(typeof t[0]=="number"||typeof t[0]=="string"&&Un.indexOf(t[0])===-1);case y.ACK:case y.BINARY_ACK:return Array.isArray(t)}}destroy(){this.reconstructor&&(this.reconstructor.finishedReconstruction(),this.reconstructor=null)}}class Hn{constructor(e){this.packet=e,this.buffers=[],this.reconPack=e}takeBinaryData(e){if(this.buffers.push(e),this.buffers.length===this.reconPack.attachments){const t=jn(this.reconPack,this.buffers);return this.finishedReconstruction(),t}return null}finishedReconstruction(){this.reconPack=null,this.buffers=[]}}const Fn=Number.isInteger||function(n){return typeof n=="number"&&isFinite(n)&&Math.floor(n)===n};function vt(n){return Object.prototype.toString.call(n)==="[object Object]"}const Vn=Object.freeze(Object.defineProperty({__proto__:null,Decoder:Ve,Encoder:zn,get PacketType(){return y}},Symbol.toStringTag,{value:"Module"}));function Y(n,e,t){return n.on(e,t),function(){n.off(e,t)}}const Kn=Object.freeze({connect:1,connect_error:1,disconnect:1,disconnecting:1,newListener:1,removeListener:1});class wt extends C{constructor(e,t,i){super(),this.connected=!1,this.recovered=!1,this.receiveBuffer=[],this.sendBuffer=[],this._queue=[],this._queueSeq=0,this.ids=0,this.acks={},this.flags={},this.io=e,this.nsp=t,i&&i.auth&&(this.auth=i.auth),this._opts=Object.assign({},i),this.io._autoConnect&&this.open()}get disconnected(){return!this.connected}subEvents(){if(this.subs)return;const e=this.io;this.subs=[Y(e,"open",this.onopen.bind(this)),Y(e,"packet",this.onpacket.bind(this)),Y(e,"error",this.onerror.bind(this)),Y(e,"close",this.onclose.bind(this))]}get active(){return!!this.subs}connect(){return this.connected?this:(this.subEvents(),this.io._reconnecting||this.io.open(),this.io._readyState==="open"&&this.onopen(),this)}open(){return this.connect()}send(...e){return e.unshift("message"),this.emit.apply(this,e),this}emit(e,...t){var i,s,r;if(Kn.hasOwnProperty(e))throw new Error('"'+e.toString()+'" is a reserved event name');if(t.unshift(e),this._opts.retries&&!this.flags.fromQueue&&!this.flags.volatile)return this._addToQueue(t),this;const o={type:y.EVENT,data:t};if(o.options={},o.options.compress=this.flags.compress!==!1,typeof t[t.length-1]=="function"){const k=this.ids++,O=t.pop();this._registerAckCallback(k,O),o.id=k}const c=(s=(i=this.io.engine)===null||i===void 0?void 0:i.transport)===null||s===void 0?void 0:s.writable,l=this.connected&&!(!((r=this.io.engine)===null||r===void 0)&&r._hasPingExpired());return this.flags.volatile&&!c||(l?(this.notifyOutgoingListeners(o),this.packet(o)):this.sendBuffer.push(o)),this.flags={},this}_registerAckCallback(e,t){var i;const s=(i=this.flags.timeout)!==null&&i!==void 0?i:this._opts.ackTimeout;if(s===void 0){this.acks[e]=t;return}const r=this.io.setTimeoutFn(()=>{delete this.acks[e];for(let c=0;c<this.sendBuffer.length;c++)this.sendBuffer[c].id===e&&this.sendBuffer.splice(c,1);t.call(this,new Error("operation has timed out"))},s),o=(...c)=>{this.io.clearTimeoutFn(r),t.apply(this,c)};o.withError=!0,this.acks[e]=o}emitWithAck(e,...t){return new Promise((i,s)=>{const r=(o,c)=>o?s(o):i(c);r.withError=!0,t.push(r),this.emit(e,...t)})}_addToQueue(e){let t;typeof e[e.length-1]=="function"&&(t=e.pop());const i={id:this._queueSeq++,tryCount:0,pending:!1,args:e,flags:Object.assign({fromQueue:!0},this.flags)};e.push((s,...r)=>(this._queue[0],s!==null?i.tryCount>this._opts.retries&&(this._queue.shift(),t&&t(s)):(this._queue.shift(),t&&t(null,...r)),i.pending=!1,this._drainQueue())),this._queue.push(i),this._drainQueue()}_drainQueue(e=!1){if(!this.connected||this._queue.length===0)return;const t=this._queue[0];t.pending&&!e||(t.pending=!0,t.tryCount++,this.flags=t.flags,this.emit.apply(this,t.args))}packet(e){e.nsp=this.nsp,this.io._packet(e)}onopen(){typeof this.auth=="function"?this.auth(e=>{this._sendConnectPacket(e)}):this._sendConnectPacket(this.auth)}_sendConnectPacket(e){this.packet({type:y.CONNECT,data:this._pid?Object.assign({pid:this._pid,offset:this._lastOffset},e):e})}onerror(e){this.connected||this.emitReserved("connect_error",e)}onclose(e,t){this.connected=!1,delete this.id,this.emitReserved("disconnect",e,t),this._clearAcks()}_clearAcks(){Object.keys(this.acks).forEach(e=>{if(!this.sendBuffer.some(i=>String(i.id)===e)){const i=this.acks[e];delete this.acks[e],i.withError&&i.call(this,new Error("socket has been disconnected"))}})}onpacket(e){if(e.nsp===this.nsp)switch(e.type){case y.CONNECT:e.data&&e.data.sid?this.onconnect(e.data.sid,e.data.pid):this.emitReserved("connect_error",new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));break;case y.EVENT:case y.BINARY_EVENT:this.onevent(e);break;case y.ACK:case y.BINARY_ACK:this.onack(e);break;case y.DISCONNECT:this.ondisconnect();break;case y.CONNECT_ERROR:this.destroy();const i=new Error(e.data.message);i.data=e.data.data,this.emitReserved("connect_error",i);break}}onevent(e){const t=e.data||[];e.id!=null&&t.push(this.ack(e.id)),this.connected?this.emitEvent(t):this.receiveBuffer.push(Object.freeze(t))}emitEvent(e){if(this._anyListeners&&this._anyListeners.length){const t=this._anyListeners.slice();for(const i of t)i.apply(this,e)}super.emit.apply(this,e),this._pid&&e.length&&typeof e[e.length-1]=="string"&&(this._lastOffset=e[e.length-1])}ack(e){const t=this;let i=!1;return function(...s){i||(i=!0,t.packet({type:y.ACK,id:e,data:s}))}}onack(e){const t=this.acks[e.id];typeof t=="function"&&(delete this.acks[e.id],t.withError&&e.data.unshift(null),t.apply(this,e.data))}onconnect(e,t){this.id=e,this.recovered=t&&this._pid===t,this._pid=t,this.connected=!0,this.emitBuffered(),this._drainQueue(!0),this.emitReserved("connect")}emitBuffered(){this.receiveBuffer.forEach(e=>this.emitEvent(e)),this.receiveBuffer=[],this.sendBuffer.forEach(e=>{this.notifyOutgoingListeners(e),this.packet(e)}),this.sendBuffer=[]}ondisconnect(){this.destroy(),this.onclose("io server disconnect")}destroy(){this.subs&&(this.subs.forEach(e=>e()),this.subs=void 0),this.io._destroy(this)}disconnect(){return this.connected&&this.packet({type:y.DISCONNECT}),this.destroy(),this.connected&&this.onclose("io client disconnect"),this}close(){return this.disconnect()}compress(e){return this.flags.compress=e,this}get volatile(){return this.flags.volatile=!0,this}timeout(e){return this.flags.timeout=e,this}onAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.push(e),this}prependAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.unshift(e),this}offAny(e){if(!this._anyListeners)return this;if(e){const t=this._anyListeners;for(let i=0;i<t.length;i++)if(e===t[i])return t.splice(i,1),this}else this._anyListeners=[];return this}listenersAny(){return this._anyListeners||[]}onAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.push(e),this}prependAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.unshift(e),this}offAnyOutgoing(e){if(!this._anyOutgoingListeners)return this;if(e){const t=this._anyOutgoingListeners;for(let i=0;i<t.length;i++)if(e===t[i])return t.splice(i,1),this}else this._anyOutgoingListeners=[];return this}listenersAnyOutgoing(){return this._anyOutgoingListeners||[]}notifyOutgoingListeners(e){if(this._anyOutgoingListeners&&this._anyOutgoingListeners.length){const t=this._anyOutgoingListeners.slice();for(const i of t)i.apply(this,e.data)}}}function ae(n){n=n||{},this.ms=n.min||100,this.max=n.max||1e4,this.factor=n.factor||2,this.jitter=n.jitter>0&&n.jitter<=1?n.jitter:0,this.attempts=0}ae.prototype.duration=function(){var n=this.ms*Math.pow(this.factor,this.attempts++);if(this.jitter){var e=Math.random(),t=Math.floor(e*this.jitter*n);n=(Math.floor(e*10)&1)==0?n-t:n+t}return Math.min(n,this.max)|0},ae.prototype.reset=function(){this.attempts=0},ae.prototype.setMin=function(n){this.ms=n},ae.prototype.setMax=function(n){this.max=n},ae.prototype.setJitter=function(n){this.jitter=n};class Ke extends C{constructor(e,t){var i;super(),this.nsps={},this.subs=[],e&&typeof e=="object"&&(t=e,e=void 0),t=t||{},t.path=t.path||"/socket.io",this.opts=t,_e(this,t),this.reconnection(t.reconnection!==!1),this.reconnectionAttempts(t.reconnectionAttempts||1/0),this.reconnectionDelay(t.reconnectionDelay||1e3),this.reconnectionDelayMax(t.reconnectionDelayMax||5e3),this.randomizationFactor((i=t.randomizationFactor)!==null&&i!==void 0?i:.5),this.backoff=new ae({min:this.reconnectionDelay(),max:this.reconnectionDelayMax(),jitter:this.randomizationFactor()}),this.timeout(t.timeout==null?2e4:t.timeout),this._readyState="closed",this.uri=e;const s=t.parser||Vn;this.encoder=new s.Encoder,this.decoder=new s.Decoder,this._autoConnect=t.autoConnect!==!1,this._autoConnect&&this.open()}reconnection(e){return arguments.length?(this._reconnection=!!e,e||(this.skipReconnect=!0),this):this._reconnection}reconnectionAttempts(e){return e===void 0?this._reconnectionAttempts:(this._reconnectionAttempts=e,this)}reconnectionDelay(e){var t;return e===void 0?this._reconnectionDelay:(this._reconnectionDelay=e,(t=this.backoff)===null||t===void 0||t.setMin(e),this)}randomizationFactor(e){var t;return e===void 0?this._randomizationFactor:(this._randomizationFactor=e,(t=this.backoff)===null||t===void 0||t.setJitter(e),this)}reconnectionDelayMax(e){var t;return e===void 0?this._reconnectionDelayMax:(this._reconnectionDelayMax=e,(t=this.backoff)===null||t===void 0||t.setMax(e),this)}timeout(e){return arguments.length?(this._timeout=e,this):this._timeout}maybeReconnectOnOpen(){!this._reconnecting&&this._reconnection&&this.backoff.attempts===0&&this.reconnect()}open(e){if(~this._readyState.indexOf("open"))return this;this.engine=new $n(this.uri,this.opts);const t=this.engine,i=this;this._readyState="opening",this.skipReconnect=!1;const s=Y(t,"open",function(){i.onopen(),e&&e()}),r=c=>{this.cleanup(),this._readyState="closed",this.emitReserved("error",c),e?e(c):this.maybeReconnectOnOpen()},o=Y(t,"error",r);if(this._timeout!==!1){const c=this._timeout,l=this.setTimeoutFn(()=>{s(),r(new Error("timeout")),t.close()},c);this.opts.autoUnref&&l.unref(),this.subs.push(()=>{this.clearTimeoutFn(l)})}return this.subs.push(s),this.subs.push(o),this}connect(e){return this.open(e)}onopen(){this.cleanup(),this._readyState="open",this.emitReserved("open");const e=this.engine;this.subs.push(Y(e,"ping",this.onping.bind(this)),Y(e,"data",this.ondata.bind(this)),Y(e,"error",this.onerror.bind(this)),Y(e,"close",this.onclose.bind(this)),Y(this.decoder,"decoded",this.ondecoded.bind(this)))}onping(){this.emitReserved("ping")}ondata(e){try{this.decoder.add(e)}catch(t){this.onclose("parse error",t)}}ondecoded(e){we(()=>{this.emitReserved("packet",e)},this.setTimeoutFn)}onerror(e){this.emitReserved("error",e)}socket(e,t){let i=this.nsps[e];return i?this._autoConnect&&!i.active&&i.connect():(i=new wt(this,e,t),this.nsps[e]=i),i}_destroy(e){const t=Object.keys(this.nsps);for(const i of t)if(this.nsps[i].active)return;this._close()}_packet(e){const t=this.encoder.encode(e);for(let i=0;i<t.length;i++)this.engine.write(t[i],e.options)}cleanup(){this.subs.forEach(e=>e()),this.subs.length=0,this.decoder.destroy()}_close(){this.skipReconnect=!0,this._reconnecting=!1,this.onclose("forced close")}disconnect(){return this._close()}onclose(e,t){var i;this.cleanup(),(i=this.engine)===null||i===void 0||i.close(),this.backoff.reset(),this._readyState="closed",this.emitReserved("close",e,t),this._reconnection&&!this.skipReconnect&&this.reconnect()}reconnect(){if(this._reconnecting||this.skipReconnect)return this;const e=this;if(this.backoff.attempts>=this._reconnectionAttempts)this.backoff.reset(),this.emitReserved("reconnect_failed"),this._reconnecting=!1;else{const t=this.backoff.duration();this._reconnecting=!0;const i=this.setTimeoutFn(()=>{e.skipReconnect||(this.emitReserved("reconnect_attempt",e.backoff.attempts),!e.skipReconnect&&e.open(s=>{s?(e._reconnecting=!1,e.reconnect(),this.emitReserved("reconnect_error",s)):e.onreconnect()}))},t);this.opts.autoUnref&&i.unref(),this.subs.push(()=>{this.clearTimeoutFn(i)})}}onreconnect(){const e=this.backoff.attempts;this._reconnecting=!1,this.backoff.reset(),this.emitReserved("reconnect",e)}}const he={};function Ee(n,e){typeof n=="object"&&(e=n,n=void 0),e=e||{};const t=Bn(n,e.path||"/socket.io"),i=t.source,s=t.id,r=t.path,o=he[s]&&r in he[s].nsps,c=e.forceNew||e["force new connection"]||e.multiplex===!1||o;let l;return c?l=new Ke(i,e):(he[s]||(he[s]=new Ke(i,e)),l=he[s]),t.query&&!e.query&&(e.query=t.queryKey),l.socket(t.path,e)}Object.assign(Ee,{Manager:Ke,Socket:wt,io:Ee,connect:Ee});function Yn(n,e,t){const i=n.apiBase||window.location.origin,s=Ee(i,{path:"/livechat-ws",auth:{siteKey:n.siteKey,visitorId:n.visitorId,sessionId:e},transports:["websocket","polling"],reconnection:!0,reconnectionDelay:600,reconnectionDelayMax:8e3});return s.on("livechat:event",r=>{r.sessionId===e&&t(r)}),s}const Wn=`
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
@media (max-width: 480px) {
  :host { bottom: 10px; right: 10px; }
  :host(.lc-position-left) { right: auto; left: 10px; }
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
  touch-action: manipulation;
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
  flex-direction: column;
  flex-shrink: 0;
}
.lc-header-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; width: 100%; }
.lc-header-inner { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
.lc-header-sub-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.9;
  color: #fff;
}
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
.lc-header-avatars { display: flex; align-items: center; flex-shrink: 0; position: relative; }
.lc-op-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.85);
  object-fit: cover;
  flex-shrink: 0;
  position: relative;
}
.lc-op-initials {
  background: rgba(255,255,255,0.22);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lc-header-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lc-header-title { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lc-header-sub { font-size: 12px; opacity: 0.9; display: flex; align-items: center; gap: 5px; }
.lc-online-dot { width: 7px; height: 7px; background: #22c55e; border-radius: 50%; flex-shrink: 0; display: inline-block; }

.lc-header-actions { display: flex; align-items: center; gap: 6px; position: relative; }

.lc-newchat-btn,
.lc-close, .lc-menu-btn {
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
  padding: 0;
}
.lc-newchat-btn:hover,
.lc-close:hover, .lc-menu-btn:hover { background: rgba(255,255,255,0.28); }
.lc-newchat-btn svg,
.lc-close svg, .lc-menu-btn svg { width: 16px; height: 16px; }

.lc-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  background: #fff;
  color: #111827;
  border-radius: 10px;
  box-shadow: 0 12px 28px rgba(0,0,0,0.18);
  min-width: 220px;
  padding: 6px;
  z-index: 10;
}
.lc-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
}
.lc-menu-item:hover { background: #f3f4f6; }
.lc-menu-item svg { width: 14px; height: 14px; flex-shrink: 0; color: #6b7280; }

.lc-md-code {
  background: rgba(0,0,0,0.06);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.92em;
}

.lc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.lc-chip {
  background: #fff;
  border: 1px solid var(--lc-brand, #2563eb);
  color: var(--lc-brand, #2563eb);
  border-radius: 16px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.lc-chip:hover {
  background: var(--lc-brand, #2563eb);
  color: #fff;
}

.lc-feedback {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(0,0,0,0.04);
  padding: 6px 10px;
  border-radius: 10px;
  margin: 8px auto;
}
.lc-feedback span { font-size: 12px; color: #4b5563; }
.lc-fb-btn {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.1s;
}
.lc-fb-btn:hover { transform: scale(1.15); }

/* Higher specificity than the global .lc-composer button rule below — the
   picker button + tabs + grid items live inside .lc-composer so without
   this they'd inherit the brand-blue circle styling. */
.lc-composer .lc-emoji-btn {
  background: transparent;
  border: 0;
  color: #6b7280;
  cursor: pointer;
  padding: 6px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.lc-composer .lc-emoji-btn:hover { background: #f3f4f6; color: #111827; }
.lc-composer .lc-emoji-btn svg { width: 18px; height: 18px; }

.lc-emoji-pop {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 8px;
  width: 280px;
  max-width: calc(100% - 16px);
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 12px 28px rgba(0,0,0,0.15);
  z-index: 12;
  overflow: hidden;
}
.lc-emoji-tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  overflow-x: auto;
}
.lc-composer .lc-emoji-tab {
  background: transparent;
  border: 0;
  padding: 8px 10px;
  width: auto;
  height: auto;
  border-radius: 0;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
}
.lc-composer .lc-emoji-tab:hover { color: #111827; background: transparent; }
.lc-composer .lc-emoji-tab-active { color: #111827; border-bottom-color: var(--lc-brand, #2563eb); font-weight: 600; }
.lc-emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  padding: 8px;
  max-height: 220px;
  overflow-y: auto;
}
.lc-composer .lc-emoji-pick {
  background: transparent;
  border: 0;
  padding: 4px;
  width: auto;
  height: 32px;
  font-size: 20px;
  cursor: pointer;
  border-radius: 6px;
  line-height: 1;
  color: inherit;
}
.lc-composer .lc-emoji-pick:hover { background: #f3f4f6; }

.lc-composer { position: relative; }

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
.lc-msg-avatar-ai { background: var(--lc-brand); }
.lc-msg-avatar-img { object-fit: cover; padding: 0; }

.lc-msg-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.lc-msg-row-visitor .lc-msg-body { align-items: flex-end; }

.lc-msg-sender { font-size: 11px; color: #6b7280; font-weight: 500; padding: 0 3px; }
.lc-msg-time { font-size: 10px; color: #9ca3af; padding: 0 3px; }

.lc-msg { padding: 9px 13px; border-radius: 16px; font-size: 14px; line-height: 1.45; word-wrap: break-word; overflow-wrap: anywhere; }
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

/* ── Inline identify (rendered as an agent bubble) ── */
.lc-inline-identify {
  padding: 10px 12px !important;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 220px;
}
.lc-inline-prompt { font-size: 13px; line-height: 1.4; color: #1f2937; }
.lc-inline-greet { color: var(--lc-brand, #2563eb); font-weight: 600; }
.lc-inline-row { display: flex; gap: 6px; align-items: stretch; }
.lc-inline-input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  font: inherit;
  background: #fff;
  outline: none;
  transition: border-color 0.15s;
}
.lc-inline-input:focus { border-color: var(--lc-brand, #2563eb); }
.lc-inline-input--invalid { border-color: #ef4444 !important; background: #fef2f2 !important; }
.lc-inline-save {
  background: var(--lc-brand, #2563eb);
  border: 0;
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s;
}
.lc-inline-save:hover { opacity: 0.9; }
.lc-inline-save svg { width: 14px; height: 14px; }
.lc-inline-skip {
  align-self: flex-start;
  background: transparent;
  border: 0;
  color: #9ca3af;
  font-size: 11px;
  padding: 0;
  cursor: pointer;
  font: inherit;
}
.lc-inline-skip:hover { color: #6b7280; }
.lc-inline-error {
  font-size: 11px;
  color: #ef4444;
  margin-top: -4px;
}

/* ── Pending attachments ── */
@keyframes lc-spin { to { transform: rotate(360deg); } }
.lc-pending { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 12px 0 12px; background: #fff; flex-shrink: 0; }
.lc-chip { display: inline-flex; align-items: center; gap: 6px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; padding: 4px 8px; font-size: 12px; color: #1f2937; max-width: 240px; }
.lc-chip--busy { opacity: 0.85; border-style: dashed; }
.lc-chip-thumb { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.lc-chip-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lc-chip-uploading { color: #6b7280; }
.lc-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid #e5e7eb; border-top-color: #6b7280; border-radius: 50%; flex-shrink: 0; animation: lc-spin 0.8s linear infinite; }
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
/* .lc-composer .lc-attach-btn wins over .lc-composer button (specificity 0,2,0 > 0,1,1) */
.lc-composer .lc-attach-btn { background: transparent; border: 0; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #6b7280; cursor: pointer; flex-shrink: 0; }
.lc-composer .lc-attach-btn:hover { background: #f3f4f6; color: #1f2937; }
.lc-attach-btn svg { width: 18px; height: 18px; }

/* ── Attachments in messages ── */
.lc-attachments { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.lc-attach-img { display: block; width: 100%; max-width: 220px; min-width: 80px; min-height: 60px; max-height: 200px; object-fit: contain; border-radius: 10px; cursor: zoom-in; background: #f3f4f6; }
.lc-attach-file { display: inline-flex; align-items: center; gap: 8px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; padding: 6px 10px; font-size: 12px; color: #1f2937; text-decoration: none; max-width: 240px; }
.lc-attach-file:hover { background: #e5e7eb; }
.lc-attach-file svg { width: 16px; height: 16px; flex-shrink: 0; color: #6b7280; }
.lc-attach-file span:first-of-type { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.lc-attach-file .lc-attach-size { color: #6b7280; flex-shrink: 0; }

/* ── Per-message rating ── */
.lc-msg-rating {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.lc-msg-row:hover .lc-msg-rating { opacity: 1; }
.lc-rate-btn {
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 2px 6px;
  font-size: 13px;
  cursor: pointer;
  line-height: 1;
  transition: background 0.12s, border-color 0.12s;
}
.lc-rate-btn:hover:not(:disabled) { background: #f3f4f6; border-color: #d1d5db; }
.lc-rate-btn:disabled { cursor: default; opacity: 0.5; }
.lc-rate-btn--active { background: #f0fdf4; border-color: #86efac; }

/* ── Streaming cursor ── */
.lc-msg--streaming {
  min-height: 1.4em;
}
.lc-msg--streaming::after {
  content: '';
  display: inline-block;
  width: 2px;
  height: 0.85em;
  background: currentColor;
  opacity: 0.6;
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: lc-cursor-blink 0.55s steps(1) infinite;
}
@keyframes lc-cursor-blink {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0; }
}

/* ── Proactive welcome bubble ── */
/* Styled as a chat bubble pointing down at the chat-launcher button.
   Width is fixed (not max-width) because the host has no intrinsic width;
   without an explicit width the bubble shrinks to longest-word size. */
.lc-proactive {
  position: absolute;
  bottom: 76px;
  right: 0;
  width: 280px;
  max-width: calc(100vw - 80px);
  background: #fff;
  border-radius: 18px 18px 4px 18px;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.08);
  padding: 14px 18px 14px 16px;
  font-size: 14px;
  color: #1f2937;
  line-height: 1.5;
  animation: lc-slide-in 0.3s ease;
}
:host(.lc-position-left) .lc-proactive {
  right: auto;
  left: 0;
  border-radius: 18px 18px 18px 4px;
}
.lc-proactive-text { cursor: pointer; padding-right: 18px; }
.lc-proactive-text:hover { text-decoration: none; }
.lc-proactive-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: 0;
  color: #9ca3af;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.lc-proactive-close:hover { color: #374151; background: #f3f4f6; }

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
  .lc-composer .lc-attach-btn {
    width: 44px;
    height: 44px;
  }
  .lc-composer .lc-emoji-btn {
    width: 44px;
    height: 44px;
  }
  .lc-composer button[type="submit"] {
    width: 44px;
    height: 44px;
  }
  /* Prevent double-tap zoom on all interactive elements. */
  .lc-close, .lc-menu-btn, .lc-newchat-btn,
  .lc-attach-btn, .lc-emoji-btn,
  .lc-composer button[type="submit"],
  .lc-rate-btn, .lc-chip, .lc-fb-btn,
  .lc-quick-replies button, .lc-session-end-btn {
    touch-action: manipulation;
  }
  /* Rating buttons: always visible on touch (no hover state). */
  .lc-msg-rating {
    opacity: 1;
  }
  /* Proactive bubble: keep it within the viewport on narrow screens. */
  .lc-proactive {
    max-width: calc(100vw - 60px);
    right: 0;
  }
  /* Emoji picker: clamp width so it never overflows the panel edge. */
  .lc-emoji-pop {
    left: 0;
    right: 0;
    width: auto;
    max-width: 100%;
    border-radius: 12px 12px 0 0;
    bottom: calc(100% + 4px);
  }
}

/* Landscape + soft keyboard: very short viewport — tighten spacing so the
   composer stays visible without sacrificing the message area. */
@media (max-width: 480px) and (max-height: 400px) {
  .lc-header { padding-top: calc(8px + env(safe-area-inset-top, 0px)); padding-bottom: 8px; }
  .lc-messages { padding: 6px 12px; }
  .lc-composer { padding-top: 6px; padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px)); }
  /* Emoji picker: shrink grid so it doesn't overflow the compressed panel. */
  .lc-emoji-grid { max-height: 110px; }
}
/* Portrait + soft keyboard: medium-height viewport (keyboard visible but not landscape).
   Reduce picker height so it fits between the header and composer. */
@media (max-width: 480px) and (min-height: 401px) and (max-height: 600px) {
  .lc-emoji-grid { max-height: 150px; }
}
`,Ye=[{name:"Smileys",emojis:["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","🙄","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤐","🤨","😐","😑","😶","😏","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷"]},{name:"Hearts",emojis:["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟"]},{name:"Hands",emojis:["👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👋","🤚","🖐️","✋","🖖","👏","🙌","🤝","🙏","✍️","💪","🦾"]},{name:"Objects",emojis:["🔥","✨","🎉","🎊","🎁","🏆","🥇","⭐","🌟","💫","💥","💯","✅","❌","⚠️","❓","❗","💡","📌","📎","🔗","🔒","🔑","⏰","⏳","📅","📆","🗓️","📊","📈"]},{name:"Travel",emojis:["🚀","✈️","🚗","🚕","🚙","🚌","🏠","🏢","🏥","🏦","🏪","🏫","⛺","🌍","🌎","🌏","🗺️","🏖️","🏔️","🌋"]}],Jn=[[":)","🙂"],[":-)","🙂"],[":D","😄"],[":-D","😄"],["xD","😆"],["XD","😆"],[":P","😛"],[":p","😋"],[":-P","😛"],[":'(","😢"],[":(","🙁"],[":-(","🙁"],[";)","😉"],[";-)","😉"],[":O","😮"],[":o","😮"],[":-O","😮"],[":oO","😳"],[":|","😐"],[":-|","😐"],[":/","😕"],[":-/","😕"],["<3","❤️"],["</3","💔"],[":*","😘"],["B)","😎"]];function Xn(n){let e=n;for(const[t,i]of Jn){const s=t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),r=new RegExp(`(^|\\s)${s}(?=\\s|$|[.,!?])`,"g");e=e.replace(r,`$1${i}`)}return e}const Gn="https://gist.githubusercontent.com/Sharifur/b40c7b54b97d43f353f1382e51c70535/raw/f6446fa378bf266cacf604f1e97f8f318e01e157/temporary-email-address-domain-list.json",_t="livechat_disposable_domains",kt="livechat_disposable_domains_ts",Qn=1440*60*1e3;let ne=null;async function St(){if(ne)return ne;try{const n=localStorage.getItem(kt),e=localStorage.getItem(_t),t=n?Number(n):0;if(e&&t&&Date.now()-t<Qn){const i=JSON.parse(e);return ne=new Set(i.map(s=>s.toLowerCase())),ne}}catch(n){}try{const n=new AbortController,e=setTimeout(()=>n.abort(),4e3),t=await fetch(Gn,{signal:n.signal});if(clearTimeout(e),t.ok){const i=await t.json(),r=(Array.isArray(i)?i:[]).map(o=>String(o).trim().toLowerCase()).filter(Boolean);ne=new Set(r);try{localStorage.setItem(_t,JSON.stringify(r)),localStorage.setItem(kt,String(Date.now()))}catch(o){}return ne}}catch(n){}return ne=new Set(["mailinator.com","guerrillamail.com","10minutemail.com","tempmail.com","temp-mail.org","yopmail.com","trashmail.com","fakeinbox.com","throwawaymail.com","getairmail.com","sharklasers.com"]),ne}async function Zn(n){const e=n.lastIndexOf("@");if(e<0)return!1;const t=n.slice(e+1).trim().toLowerCase();return t?(await St()).has(t):!1}function ei(){St()}const ti={siteKey:"",botName:"Hi there",botSubtitle:"We typically reply in a few seconds.",welcomeMessage:null,brandColor:"#2563eb",position:"bottom-right"},Te="livechat_messages_cache_v2",Et="livechat_cache_bust",We="livechat_session_id",Je="livechat_identify_dismissed",Ie="livechat_identify_name",pe="livechat_identify_email",Tt="livechat_send_log",Ae="livechat_proactive_seen",ni=30,ii=6e4,si=3;function ri(n,e=ti){var me,ge,Ce;fi(n.siteKey,e.cacheBust);const t=Date.now(),i=document.createElement("div");i.id="livechat-widget-root";const s=()=>window.innerWidth<=480,r="10px",o="10px",c="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;",l=`position: fixed; bottom: ${r}; right: ${o}; z-index: 2147483646;`;i.style.cssText=s()?l:c,document.body.appendChild(i);const b=i.attachShadow({mode:"open"}),k=(me=gi(e.brandColor))!=null?me:"#2563eb",O=Ct(k,.35),v=Ct(k,.45);i.style.setProperty("--lc-brand",k),i.style.setProperty("--lc-brand-shadow",O),i.style.setProperty("--lc-brand-shadow-hover",v),e.position==="bottom-left"&&i.classList.add("lc-position-left");const N=document.createElement("style");N.textContent=Wn,b.appendChild(N);const V=()=>{i.style.setProperty("--lc-brand",k),i.style.setProperty("--lc-brand-shadow",O),i.style.setProperty("--lc-brand-shadow-hover",v)},h={open:!1,sessionId:pi(),messages:mi(),socket:null,panel:null,askedForEmail:!1,askedForName:!1,knownName:li(),unread:0,sessionClosed:!1,feedbackAsked:!1,operators:(ge=e.operators)!=null?ge:[],host:i,cfg:n,reapplyCssVars:V,activeDraftId:null,historyPushed:!1,pendingTrigger:void 0,closePanelAnim:void 0,collectPageContext:void 0,requireEmail:(Ce=e.requireEmail)!=null?Ce:!1},P=document.createElement("button");P.className="lc-bubble",P.innerHTML=Si(),b.appendChild(P);const w=document.createElement("span");w.className="lc-unread",w.style.display="none",P.appendChild(w);const p=document.createElement("div");if(p.className="lc-proactive",p.style.display="none",e.welcomeMessage){p.innerHTML=`
      <button class="lc-proactive-close" aria-label="Dismiss">&#x2715;</button>
      <div class="lc-proactive-text">${R(e.welcomeMessage)}</div>
    `,b.appendChild(p);let _=!1;try{_=!!sessionStorage.getItem(Ae)}catch(U){}_||setTimeout(()=>{h.open||(p.style.display="block")},1500),p.querySelector(".lc-proactive-close").addEventListener("click",U=>{U.stopPropagation(),p.style.display="none";try{sessionStorage.setItem(Ae,"1")}catch(A){}}),p.querySelector(".lc-proactive-text").addEventListener("click",()=>{p.style.display="none";try{sessionStorage.setItem(Ae,"1")}catch(U){}P.click()})}h.messages.length===0&&e.welcomeMessage&&(h.messages.push({id:"welcome",role:"agent",content:e.welcomeMessage,createdAt:new Date().toISOString()}),re(h.messages));const $=oi(b,n,h,ie,e);$.style.display="none",h.panel=$,$._state=h,$._cfg=n;function u(){const _=window.visualViewport;_?i.style.cssText=`position: fixed; top: ${_.offsetTop}px; left: ${_.offsetLeft}px; width: ${_.width}px; height: ${_.height}px; z-index: 2147483646;`:i.style.cssText="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483646;",V()}let S=null;function M(){S!==null&&cancelAnimationFrame(S),S=requestAnimationFrame(()=>{S=null,h.open&&(s()?u():(i.style.cssText=c,V()))})}let q=!1;function X(){q||!window.visualViewport||(q=!0,window.visualViewport.addEventListener("resize",M),window.visualViewport.addEventListener("scroll",M),window.addEventListener("orientationchange",()=>{setTimeout(M,150)}))}window.addEventListener("popstate",()=>{h.open&&h.historyPushed&&(h.historyPushed=!1,ce())});function et(){var U,A,Re,oe;const _={};try{const I=document.body.scrollHeight-window.innerHeight;_.scrollDepth=I>0?Math.round(window.scrollY/I*100):100}catch(I){}_.timeOnPageSec=Math.round((Date.now()-t)/1e3);try{const I=(A=(U=document.querySelector("h1"))==null?void 0:U.textContent)==null?void 0:A.trim().slice(0,100);I&&(_.pageH1=I)}catch(I){}try{const I=(oe=(Re=document.querySelector('meta[name="description"]'))==null?void 0:Re.content)==null?void 0:oe.trim().slice(0,200);I&&(_.metaDescription=I)}catch(I){}try{const I=new URLSearchParams(window.location.search);I.get("utm_source")&&(_.utmSource=I.get("utm_source").slice(0,80)),I.get("utm_campaign")&&(_.utmCampaign=I.get("utm_campaign").slice(0,80)),I.get("utm_medium")&&(_.utmMedium=I.get("utm_medium").slice(0,80)),I.get("utm_term")&&(_.utmTerm=I.get("utm_term").slice(0,80))}catch(I){}try{document.referrer&&(_.referrerDomain=new URL(document.referrer).hostname.slice(0,100))}catch(I){}try{_.isReturnVisitor=!!localStorage.getItem("livechat_session_id")}catch(I){}return h.pendingTrigger&&(_.triggeredBy=h.pendingTrigger.slice(0,100),h.pendingTrigger=void 0),n.context&&Object.keys(n.context).length&&(_.custom=n.context),_}h.collectPageContext=et,document.addEventListener("click",_=>{var A;const U=_.target.closest("[data-lc-open]");U&&(_.preventDefault(),h.pendingTrigger=(A=U.getAttribute("data-lc-open"))!=null?A:void 0,h.open||(h.open=!0,Oe()))});function Oe(){var _;if(s()){u(),X();try{history.pushState({lcPanel:!0},""),h.historyPushed=!0}catch(U){}}$.classList.remove("lc-panel--closing"),$.style.display="flex",h.unread=0,w.style.display="none",At($),Xe(h),(_=$.querySelector("textarea"))==null||_.focus()}function ce(){h.open=!1,$.classList.add("lc-panel--closing"),setTimeout(()=>{h.open||($.style.display="none",s()&&(i.style.cssText=l,V())),$.classList.remove("lc-panel--closing")},180)}h.closePanelAnim=ce,P.addEventListener("click",()=>{p.style.display="none";try{sessionStorage.setItem(Ae,"1")}catch(_){}if(h.open=!h.open,h.open)Oe();else{if(h.historyPushed){h.historyPushed=!1;try{history.back()}catch(_){}}ce()}}),h.sessionId&&It(n,h,ie,e),ei();function ie(){ai($,h),!h.open&&h.unread>0?(w.textContent=String(Math.min(h.unread,99)),w.style.display="flex"):w.style.display="none"}ie()}function oi(n,e,t,i,s){var Ht,Ft,Vt,Kt;const r=document.createElement("div");r.className="lc-panel";const c=((Ht=s.operators)!=null?Ht:[]).length>1?((Ft=s.botName)==null?void 0:Ft.trim())||s.operatorName||"Chat with us":((Vt=s.operatorName)==null?void 0:Vt.trim())||s.botName;r.innerHTML=`
    <div class="lc-header">
      <div class="lc-header-top">
        <div class="lc-header-inner">
          ${Ci((Kt=s.operators)!=null?Kt:[],s.operatorName)}
          <div class="lc-header-text">
            <div class="lc-header-title">${R(c)}</div>
          </div>
        </div>
        <div class="lc-header-actions">
          <button class="lc-newchat-btn" aria-label="Start new conversation">${Oi()}</button>
          <button class="lc-menu-btn" aria-label="Conversation menu" aria-haspopup="true">${Ti()}</button>
          <div class="lc-menu" role="menu" style="display:none;">
            <button class="lc-menu-item" data-action="new">${Ii()} Start a new conversation</button>
            <button class="lc-menu-item" data-action="close">${Ai()} End this chat</button>
          </div>
          <button class="lc-close" aria-label="Close">${Rt()}</button>
        </div>
      </div>
      <div class="lc-header-sub-row">
        <span class="lc-online-dot"></span>${R(s.botSubtitle)}
      </div>
    </div>
    <div class="lc-messages-wrap">
      <div class="lc-messages"></div>
      <button class="lc-scroll-btn" type="button" style="display:none;" aria-label="Scroll to latest">${Rt()} New messages</button>
    </div>
    <div class="lc-quick-replies" style="display:none;"></div>
    <div class="lc-toast" role="alert" style="display:none;"></div>
    <div class="lc-pending" style="display:none;"></div>
    <div class="lc-session-end" style="display:none;">
      <span>This conversation has ended.</span>
      <button type="button" class="lc-session-end-btn">Start new chat</button>
    </div>
    <form class="lc-composer" autocomplete="off">
      <input class="lc-hp" name="website" tabindex="-1" autocomplete="off" />
      <input class="lc-file-input" type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" style="display:none;" />
      <button type="button" class="lc-attach-btn" aria-label="Attach file">${_i()}</button>
      <button type="button" class="lc-emoji-btn" aria-label="Insert emoji">${Li()}</button>
      <div class="lc-emoji-pop" style="display:none;" role="dialog" aria-label="Emoji picker">
        <div class="lc-emoji-tabs">${Ye.map((a,d)=>`<button type="button" class="lc-emoji-tab${d===0?" lc-emoji-tab-active":""}" data-cat="${d}">${a.name}</button>`).join("")}</div>
        <div class="lc-emoji-grid">${Ye[0].emojis.map(a=>`<button type="button" class="lc-emoji-pick" data-emoji="${a}">${a}</button>`).join("")}</div>
      </div>
      <textarea placeholder="Type your message…" rows="1"></textarea>
      <button type="submit" aria-label="Send">${$t()}</button>
    </form>
  `,n.appendChild(r);const b=t.host.classList.contains("lc-position-left")?"position: fixed; bottom: 10px; left: 10px; z-index: 2147483646;":"position: fixed; bottom: 10px; right: 10px; z-index: 2147483646;";r.querySelector(".lc-newchat-btn").addEventListener("click",()=>{confirm("Start a new conversation? The current chat will be cleared.")&&U()}),r.querySelector(".lc-close").addEventListener("click",()=>{if(t.historyPushed){t.historyPushed=!1;try{history.back()}catch(a){}}if(t.closePanelAnim){t.closePanelAnim();return}t.open=!1,r.classList.add("lc-panel--closing"),setTimeout(()=>{var a;r.style.display="none",window.innerWidth<=480&&(t.host.style.cssText=b,(a=t.reapplyCssVars)==null||a.call(t)),r.classList.remove("lc-panel--closing")},180)});const v=r.querySelector(".lc-menu-btn"),N=r.querySelector(".lc-menu"),V=()=>{N.style.display="none"};v.addEventListener("click",a=>{a.stopPropagation(),N.style.display=N.style.display==="none"?"block":"none"}),r.addEventListener("click",a=>{!N.contains(a.target)&&a.target!==v&&V()}),N.addEventListener("click",async a=>{const d=a.target.closest(".lc-menu-item");if(!d)return;V();const f=d.getAttribute("data-action");if(f==="new"){if(!confirm("Start a new conversation? The current chat will be cleared."))return;U()}else if(f==="close"){if(!confirm("End this chat? You can always start a new one."))return;const x=t.sessionId;if(x)try{await fetch(`${e.apiBase}/livechat/session/${encodeURIComponent(x)}/close`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:e.siteKey,visitorId:e.visitorId}),credentials:"omit"})}catch(m){}U(),t.messages=[{id:`system-${Date.now()}`,role:"system",content:"Chat ended. Type a message to start a new conversation.",createdAt:new Date().toISOString()}],re(t.messages),i()}});const h=r.querySelector(".lc-messages"),P=r.querySelector(".lc-scroll-btn");h.addEventListener("scroll",()=>{const a=h.scrollHeight-h.scrollTop-h.clientHeight;P.style.display=a>120?"flex":"none"}),P.addEventListener("click",()=>{h.scrollTop=h.scrollHeight,P.style.display="none"});const w=r.querySelector(".lc-composer"),p=r.querySelector("textarea"),$=r.querySelector(".lc-hp"),u=r.querySelector('.lc-composer button[type="submit"]'),S=r.querySelector(".lc-attach-btn"),M=r.querySelector(".lc-file-input"),q=r.querySelector(".lc-pending"),X=r.querySelector(".lc-quick-replies"),et=r.querySelector(".lc-session-end"),Oe=r.querySelector(".lc-session-end-btn"),ce=r.querySelector(".lc-emoji-btn"),ie=r.querySelector(".lc-emoji-pop"),me=r.querySelector(".lc-emoji-tabs"),ge=r.querySelector(".lc-emoji-grid");function Ce(a){var m,E;const d=(m=p.selectionStart)!=null?m:p.value.length,f=(E=p.selectionEnd)!=null?E:d;p.value=p.value.slice(0,d)+a+p.value.slice(f);const x=d+a.length;p.setSelectionRange(x,x),p.focus()}function _(a){const d=Ye[a];d&&(ge.innerHTML=d.emojis.map(f=>`<button type="button" class="lc-emoji-pick" data-emoji="${f}">${f}</button>`).join(""))}ce.addEventListener("click",a=>{a.stopPropagation(),ie.style.display=ie.style.display==="none"?"block":"none"}),r.addEventListener("click",a=>{a.target instanceof Node&&!ie.contains(a.target)&&a.target!==ce&&(ie.style.display="none")}),me.addEventListener("click",a=>{var f;const d=a.target.closest(".lc-emoji-tab");d&&(me.querySelectorAll(".lc-emoji-tab").forEach(x=>x.classList.remove("lc-emoji-tab-active")),d.classList.add("lc-emoji-tab-active"),_(Number((f=d.getAttribute("data-cat"))!=null?f:0)))}),ge.addEventListener("click",a=>{var f;const d=a.target.closest(".lc-emoji-pick");d&&Ce((f=d.getAttribute("data-emoji"))!=null?f:"")}),p.addEventListener("input",()=>{var f;const a=p.value,d=Xn(a);if(d!==a){const x=d.length-a.length,m=((f=p.selectionStart)!=null?f:a.length)+x;p.value=d,p.setSelectionRange(m,m)}});function U(){var a;(a=t.socket)==null||a.disconnect(),t.socket=null,t.sessionId=null,t.sessionClosed=!1,t.messages=[],t.askedForEmail=!1,t.unread=0;try{localStorage.removeItem(We)}catch(d){}try{localStorage.removeItem(Te)}catch(d){}try{localStorage.removeItem(Je)}catch(d){}et.style.display="none",p.disabled=!1,u.disabled=!1,S.disabled=!1,s!=null&&s.welcomeMessage&&(t.messages.push({id:"welcome",role:"agent",content:s.welcomeMessage,createdAt:new Date().toISOString()}),re(t.messages)),i()}Oe.addEventListener("click",U);const A=[],Re=Date.now();let oe=!1;p.addEventListener("keydown",()=>{oe=!0}),p.addEventListener("input",()=>{oe=!0});function I(a){p.value=a,oe=!0,w.requestSubmit()}r._submitFromChip=I;const jt=()=>{var x;const a=t.messages.some(m=>m.role==="visitor"),d=/\b(talk|speak|connect|chat)\b.*\b(human|agent|person|representative|support team)\b|\b(human|live agent|real person)\b/i,f=((x=s.welcomeQuickReplies)!=null?x:[]).filter(Boolean).filter(m=>!d.test(m));if(a||f.length===0){X.style.display="none",X.innerHTML="";return}X.style.display="flex",X.innerHTML=f.map((m,E)=>`<button data-i="${E}" type="button">${R(m)}</button>`).join(""),X.querySelectorAll("button").forEach(m=>{m.addEventListener("click",()=>{const E=Number(m.dataset.i),B=f[E];B&&I(B)})})};S.addEventListener("click",()=>M.click()),M.addEventListener("change",async()=>{var x;const a=(x=M.files)==null?void 0:x[0];if(M.value="",!a)return;if(a.size>10*1024*1024){F(r,`File too large: ${a.name} (max 10 MB)`);return}if(A.length>=5){F(r,"You can attach up to 5 files per message.");return}if(!t.sessionId){F(r,"Send a message first, then attach files.");return}const d=a.type.startsWith("image/")?URL.createObjectURL(a):void 0,f={id:"pending-"+Date.now(),mimeType:a.type,sizeBytes:a.size,originalFilename:a.name,url:"",localUrl:d};A.push(f),se();try{const m=await D(e,t.sessionId,a),E=A.indexOf(f);E>=0&&(A[E]=le(ee({},m),{localUrl:d})),se()}catch(m){const E=A.indexOf(f);E>=0&&A.splice(E,1),d&&URL.revokeObjectURL(d),F(r,`Upload failed: ${m.message}`),se()}});function se(){if(!A.length){q.style.display="none",q.innerHTML="";return}q.style.display="flex",q.innerHTML=A.map((a,d)=>{var g;const f=a.id.startsWith("pending-"),x=(g=a.localUrl)!=null?g:"",E=a.mimeType.startsWith("image/")&&x?`<img class="lc-chip-thumb" src="${R(x)}" alt="">`:"",B=f?`${E}<span class="lc-chip-label lc-chip-uploading">Uploading…</span><span class="lc-spinner"></span>`:`${E}<span class="lc-chip-label">${R(a.originalFilename)}</span><button data-i="${d}" aria-label="Remove">×</button>`;return`<span class="lc-chip${f?" lc-chip--busy":""}">${B}</span>`}).join(""),q.querySelectorAll("button[data-i]").forEach(a=>{a.addEventListener("click",()=>{const d=Number(a.dataset.i),f=A.splice(d,1)[0];f!=null&&f.localUrl&&URL.revokeObjectURL(f.localUrl),se()})})}let tt=null,Ut=!1;const ye=a=>{var d;Ut!==a&&(Ut=a,(d=t.socket)==null||d.emit("livechat:typing",{on:a}))};p.addEventListener("input",()=>{p.style.height="auto",p.style.height=Math.min(120,p.scrollHeight)+"px",p.value.trim()?(ye(!0),tt&&clearTimeout(tt),tt=setTimeout(()=>ye(!1),1500)):ye(!1)}),p.addEventListener("blur",()=>ye(!1)),p.addEventListener("keydown",a=>{a.key==="Enter"&&!a.shiftKey&&(a.preventDefault(),w.requestSubmit())}),p.addEventListener("paste",async a=>{var x;const d=(x=a.clipboardData)==null?void 0:x.items;if(!d)return;const f=[];for(const m of d)if(m.kind==="file"&&m.type.startsWith("image/")){const E=m.getAsFile();E&&f.push(E)}if(f.length){if(a.preventDefault(),!t.sessionId){F(r,"Send a message first, then paste images.");return}for(const m of f){if(m.size>10*1024*1024){F(r,`Pasted image too large: ${m.name||"image"} (max 10 MB)`);continue}if(A.length>=5)break;const E=m.name?m:new File([m],`pasted-${Date.now()}.png`,{type:m.type}),B=URL.createObjectURL(E),g={id:"pending-"+Math.random().toString(36).slice(2),mimeType:m.type,sizeBytes:m.size,originalFilename:E.name,url:"",localUrl:B};A.push(g),se();try{const L=await D(e,t.sessionId,E),T=A.indexOf(g);T>=0&&(A[T]=le(ee({},L),{localUrl:B})),se()}catch(L){const T=A.indexOf(g);T>=0&&A.splice(T,1),URL.revokeObjectURL(B),F(r,`Upload failed: ${L.message}`),se()}}}}),w.addEventListener("submit",async a=>{var m,E,B;if(a.preventDefault(),$.value)return;if(t.sessionClosed){F(r,"This conversation has ended. Start a new chat below.");return}const d=p.value.trim(),f=A.some(g=>g.id.startsWith("pending-")),x=A.filter(g=>g.url&&!g.id.startsWith("pending-"));if(f){F(r,"Your image is still uploading — please wait a moment.");return}if(!(!d&&!x.length)){if(!hi()){F(r,"Slow down — too many messages in the last minute.");return}if(s.requireEmail){let g=!1;try{const L=localStorage.getItem(pe);g=L==="saved"||!!L&&L!=="skipped"}catch(L){}if(!g&&t.messages.some(T=>T.role==="visitor")){F(r,"Please enter your email to continue.");const T=r.querySelector('.lc-inline-identify[data-step="email"] .lc-inline-input');T&&T.focus();return}}u.disabled=!0,p.value="",p.style.height="auto",ye(!1),di(t,d,x),A.length=0,se(),jt(),i(),Lt(r);try{const g=await Qt(e,d,x.map(L=>L.id),{hp:$.value||void 0,elapsedMs:Date.now()-Re,hadInteraction:oe},(E=(m=t.collectPageContext)==null?void 0:m.call(t))!=null?E:{});if(ue(r),t.sessionId=g.sessionId,ui(g.sessionId),"content"in g.agent&&g.agent.content){const L=(B=g.agent.id)!=null?B:"";if(!t.socket)Ge(t,g.agent.content,L);else{const T=g.agent.content;setTimeout(()=>{t.messages.some(Q=>Q.id===L)||!!t.activeDraftId||(Ge(t,T,L),i())},250)}}if(t.socket||It(e,t,i,s),s.requireEmail){let L=!1;try{const T=localStorage.getItem(pe);L=T==="saved"||!!T&&T!=="skipped"}catch(T){}L||t.messages.some(G=>G.id==="identify-email"||G.id==="identify-email-done")||(t.messages.push({id:"identify-email",role:"agent",content:"__identify_email__",createdAt:new Date().toISOString()}),i())}else ci(r,t,i)}catch(g){ue(r),F(r,"Could not send — please try again.")}u.disabled=!1,i()}});const zt=r.querySelector(".lc-messages");return zt.addEventListener("click",async a=>{var m,E;const d=a.target,f=d.closest(".lc-inline-skip");if(f){const B=f.getAttribute("data-step");if(B==="name")try{localStorage.setItem(Ie,"skipped")}catch(g){}else if(B==="email")try{localStorage.setItem(pe,"skipped")}catch(g){}t.messages=t.messages.filter(g=>g.id!==`identify-${B}`),i();return}const x=d.closest(".lc-inline-save");if(x){const B=x.getAttribute("data-step"),g=x.closest(".lc-inline-identify"),L=g==null?void 0:g.querySelector("input"),T=(E=(m=L==null?void 0:L.value)==null?void 0:m.trim())!=null?E:"";if(B==="name"){if(!T)return;try{await it(e,{name:T}),t.knownName=T;try{localStorage.setItem(Ie,T)}catch(Q){}const G=t.messages.findIndex(Q=>Q.id==="identify-name");G>=0&&(t.messages[G]={id:"identify-name-done",role:"system",content:`Nice to meet you, ${T}!`,createdAt:new Date().toISOString()}),i()}catch(G){}}else if(B==="email"){const G=Q=>{var Yt;L==null||L.classList.add("lc-inline-input--invalid");let Z=g==null?void 0:g.querySelector(".lc-inline-error");!Z&&g&&(Z=document.createElement("div"),Z.className="lc-inline-error",(Yt=g.querySelector(".lc-inline-row"))==null||Yt.after(Z)),Z&&(Z.textContent=Q)};if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(T)){G("That doesn't look right — double-check?");return}if(await Zn(T)){G("Please use a permanent email — we can’t follow up on temporary inboxes.");return}try{await it(e,{email:T});try{localStorage.setItem(pe,"saved")}catch(Z){}try{localStorage.setItem(Je,"saved")}catch(Z){}const Q=t.messages.findIndex(Z=>Z.id==="identify-email");Q>=0&&(t.messages[Q]={id:"identify-email-done",role:"system",content:`Great — we'll reach out at ${T} if we miss you here.`,createdAt:new Date().toISOString()}),i()}catch(Q){}}}}),zt.addEventListener("keydown",a=>{const d=a;if(d.key!=="Enter")return;const f=d.target;if(!f.matches(".lc-inline-identify input"))return;d.preventDefault();const x=f.closest(".lc-inline-identify"),m=x==null?void 0:x.querySelector(".lc-inline-save");m==null||m.click()}),jt(),r}function Xe(n){if(!n.open||!n.socket)return;n._seenIds||(n._seenIds=new Set);const e=n.messages.filter(t=>(t.role==="agent"||t.role==="operator")&&!n._seenIds.has(t.id)).map(t=>t.id);e.length&&(e.forEach(t=>n._seenIds.add(t)),n.socket.emit("livechat:messages_seen",{messageIds:e}))}function It(n,e,t,i){!e.sessionId||e.socket||(e.socket=Yn(n,e.sessionId,s=>{var l,b,k,O,v,N,V,h,P,w,p,$;if(s.type==="typing"){const u=e.panel;if(!u)return;s.on?Lt(u):ue(u);return}if(s.type==="session_status"&&s.status==="closed"){(l=e.socket)==null||l.disconnect(),e.socket=null,e.sessionClosed=!0;const u=e.panel;if(u){const S=u.querySelector(".lc-session-end"),M=u.querySelector("textarea"),q=u.querySelector('.lc-composer button[type="submit"]'),X=u.querySelector(".lc-attach-btn");S&&(S.style.display="flex"),M&&(M.disabled=!0),q&&(q.disabled=!0),X&&(X.disabled=!0),e.feedbackAsked||(e.feedbackAsked=!0,e.messages.push({id:`feedback-${Date.now()}`,role:"system",content:"__feedback__",createdAt:new Date().toISOString()}))}t();return}if(s.type==="agent_stream_start"&&s.draftId){const u=e.panel;u&&ue(u),e.messages.some(S=>S.id===s.draftId)||(e.activeDraftId=s.draftId,e.messages.push({id:s.draftId,role:"agent",content:"",createdAt:(b=s.createdAt)!=null?b:new Date().toISOString()}),t());return}if(s.type==="agent_stream_delta"&&s.draftId&&s.delta){const u=e.messages.findIndex(S=>S.id===s.draftId);if(u>=0){e.messages[u]=le(ee({},e.messages[u]),{content:e.messages[u].content+s.delta});const S=e.panel,M=S==null?void 0:S.querySelector(".lc-msg--streaming");if(M){M.textContent=e.messages[u].content;const q=S==null?void 0:S.querySelector(".lc-messages");q&&(q.scrollTop=q.scrollHeight)}else t()}return}if(s.type==="agent_stream_end"&&s.draftId&&s.messageId){e.activeDraftId=null;const u=e.messages.findIndex(S=>S.id===s.draftId);if(e.messages.some(S=>S.id===s.messageId)){u>=0&&(e.messages.splice(u,1),re(e.messages),t());return}u>=0&&(e.messages[u]=le(ee({},e.messages[u]),{id:s.messageId,content:(k=s.content)!=null?k:e.messages[u].content}),re(e.messages),e.open?Xe(e):(e.unread=((O=e.unread)!=null?O:0)+1,Ot()),t());return}if(s.type==="agent_suggestions"&&s.messageId&&((v=s.suggestions)!=null&&v.length)){const u=e.messages.findIndex(S=>S.id===s.messageId);u>=0&&(e.messages[u]=le(ee({},e.messages[u]),{suggestions:s.suggestions.slice(0,3)}),t());return}if(s.type!=="message"||!s.messageId||s.role==="visitor"||e.messages.some(u=>u.id===s.messageId))return;if(e.activeDraftId){const u=e.messages.findIndex(S=>S.id===e.activeDraftId);u>=0&&e.messages.splice(u,1),e.activeDraftId=null}const r=(N=s.operatorName)!=null?N:void 0,o=(w=s.operatorAvatarUrl)!=null?w:r&&(P=(h=(V=i==null?void 0:i.operators)==null?void 0:V.find(u=>u.name===r))==null?void 0:h.avatarUrl)!=null?P:void 0;Ge(e,(p=s.content)!=null?p:"",s.messageId,s.role==="operator",s.attachments,r,o);const c=e.panel;c&&ue(c),e.open?Xe(e):(e.unread=(($=e.unread)!=null?$:0)+1,Ot()),t()}))}function ai(n,e){const t=n.querySelector(".lc-messages");if(!t)return;if(e.messages.length===0){t.innerHTML='<div class="lc-empty">Send us a message — we will get right back to you.</div>';return}const i=(()=>{for(let s=e.messages.length-1;s>=0;s--){const r=e.messages[s];if(r.role==="agent"||r.role==="operator")return s;if(r.role==="visitor")return-1}return-1})();t.innerHTML=e.messages.map((s,r)=>{var h,P;if(s.content==="__identify_name__"||s.content==="__identify_email__"){const w=s.content==="__identify_name__",p=w?"name":"email",$=!w&&e.knownName?`<span class="lc-inline-greet">Thanks ${R(e.knownName)}! </span>`:"",u=w?"Mind if I get your name?":`${$}If we miss you here, what's the best email to follow up on?`,S=w?"Your name":"you@example.com",M=w?"text":"email",q=w?"given-name":"email";return`<div class="lc-msg-row lc-msg-row-agent">
          <div class="lc-msg-avatar lc-msg-avatar-ai">${Bt()}</div>
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-agent lc-inline-identify" data-step="${p}">
              <div class="lc-inline-prompt">${u}</div>
              <div class="lc-inline-row">
                <input type="${M}" class="lc-inline-input" placeholder="${S}" autocomplete="${q}" />
                <button type="button" class="lc-inline-save" data-step="${p}" aria-label="Save">${$t()}</button>
              </div>
              ${w||!e.requireEmail?`<button type="button" class="lc-inline-skip" data-step="${p}">${w?"Skip":"Maybe later"}</button>`:""}
            </div>
          </div>
        </div>`}const o=s.content?s.role==="visitor"?bi(s.content):xi(s.content):"",c=((h=s.attachments)!=null?h:[]).map(yi).join(""),l=c?`<div class="lc-attachments">${c}</div>`:"",b=wi(s.createdAt),k=b?`<div class="lc-msg-time">${b}</div>`:"",O=r===i&&s.suggestions&&s.suggestions.length?`<div class="lc-chips">${s.suggestions.map(w=>`<button class="lc-chip" data-chip="${H(w)}">${R(w)}</button>`).join("")}</div>`:"";if(s.role==="system")return s.content==="__feedback__"?`<div class="lc-msg lc-msg-system lc-feedback" data-feedback-id="${H(s.id)}">
            <span>How was this chat?</span>
            <button class="lc-fb-btn" data-rating="up" aria-label="Good">👍</button>
            <button class="lc-fb-btn" data-rating="down" aria-label="Bad">👎</button>
          </div>`:`<div class="lc-msg lc-msg-system">${o}</div>`;if(s.role==="visitor")return`<div class="lc-msg-row lc-msg-row-visitor">
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-visitor">${o}${l}</div>
            ${k}
          </div>
        </div>`;const v=s.id&&s.id!=="welcome"?`<div class="lc-msg-rating" data-msg-id="${H(s.id)}">
            <button class="lc-rate-btn" data-rating="up" aria-label="Helpful">&#128077;</button>
            <button class="lc-rate-btn" data-rating="down" aria-label="Not helpful">&#128078;</button>
           </div>`:"";if(s.role==="operator"){const w=(P=s.operatorName)!=null?P:"Operator";return`<div class="lc-msg-row lc-msg-row-agent">
          ${s.operatorAvatarUrl?`<img class="lc-msg-avatar lc-msg-avatar-img" src="${H(s.operatorAvatarUrl)}" alt="${R(w)}" title="${R(w)}">`:`<div class="lc-msg-avatar lc-msg-avatar-op" title="${R(w)}">${R(Qe(w))}</div>`}
          <div class="lc-msg-body">
            <div class="lc-msg-sender">${R(w)}</div>
            <div class="lc-msg lc-msg-agent">${o}${l}</div>
            ${k}
            ${O}
          </div>
        </div>`}const N=s.id===e.activeDraftId,V=N?" lc-msg--streaming":"";return`<div class="lc-msg-row lc-msg-row-agent">
        <div class="lc-msg-avatar lc-msg-avatar-ai">${Bt()}</div>
        <div class="lc-msg-body">
          <div class="lc-msg lc-msg-agent${V}">${N?R(s.content):o}${l}</div>
          ${k}
          ${O}
          ${v}
        </div>
      </div>`}).join(""),t.querySelectorAll(".lc-msg-rating").forEach(s=>{s.querySelectorAll(".lc-rate-btn").forEach(r=>{r.addEventListener("click",async()=>{var k,O,v;const o=r.getAttribute("data-rating"),c=(k=s.getAttribute("data-msg-id"))!=null?k:"",l=(v=(O=n._state)==null?void 0:O.sessionId)!=null?v:"",b=n._cfg;if(!(!c||!l||!b)){s.querySelectorAll(".lc-rate-btn").forEach(N=>N.disabled=!0),r.classList.add("lc-rate-btn--active");try{await fetch(`${b.apiBase}/livechat/session/${encodeURIComponent(l)}/message/${encodeURIComponent(c)}/rating`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:b.siteKey,visitorId:b.visitorId,rating:o}),credentials:"omit"})}catch(N){}}})})}),t.querySelectorAll(".lc-chip").forEach(s=>{s.addEventListener("click",()=>{var c;const r=(c=s.getAttribute("data-chip"))!=null?c:"";if(!r)return;const o=n._submitFromChip;if(o)o(r);else{const l=n.querySelector("textarea"),b=n.querySelector(".lc-composer");if(!l||!b)return;l.value=r,l.dispatchEvent(new Event("input",{bubbles:!0})),b.requestSubmit()}})}),t.querySelectorAll(".lc-fb-btn").forEach(s=>{s.addEventListener("click",async()=>{const r=s.closest(".lc-feedback"),o=s.getAttribute("data-rating");if(!r||!o)return;const c=e.sessionId,l=e.cfg;if(c&&l)try{await fetch(`${l.apiBase}/livechat/session/${encodeURIComponent(c)}/feedback`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:l.siteKey,visitorId:l.visitorId,rating:o}),credentials:"omit"})}catch(b){}r.innerHTML="<span>Thanks for the feedback!</span>"})}),At(n)}function At(n){const e=n.querySelector(".lc-messages");e&&(e.scrollTop=e.scrollHeight)}function Lt(n){const e=n.querySelector(".lc-messages");if(!e||e.querySelector(".lc-typing"))return;const t=document.createElement("div");t.className="lc-typing",t.innerHTML="<span></span><span></span><span></span>",e.appendChild(t),e.scrollTop=e.scrollHeight}function ue(n){n.querySelectorAll(".lc-typing").forEach(e=>e.remove())}function ci(n,e,t){let i=!1;try{i=!!localStorage.getItem(Je)}catch(v){}const s=e.messages,r=s.filter(v=>v.role==="visitor").length,o=s.filter(v=>v.role==="agent").length;let c=null;try{c=localStorage.getItem(Ie)}catch(v){}const l=!!c||!!e.knownName||i,b=s.some(v=>v.id==="identify-name"||v.id==="identify-name-done");!l&&!b&&o>=1&&(e.askedForName=!0,e.messages.push({id:"identify-name",role:"agent",content:"__identify_name__",createdAt:new Date().toISOString()}),t());let k=!1;try{k=!!localStorage.getItem(pe)}catch(v){}const O=s.some(v=>v.id==="identify-email"||v.id==="identify-email-done");!k&&!i&&!O&&r>=si&&(e.askedForEmail=!0,e.messages.push({id:"identify-email",role:"agent",content:"__identify_email__",createdAt:new Date().toISOString()}),t())}function li(){try{const n=localStorage.getItem(Ie);return!n||n==="saved"||n==="skipped"?null:n}catch(n){return null}}function di(n,e,t){n.messages.push({id:"local-"+Date.now(),role:"visitor",content:e,createdAt:new Date().toISOString(),attachments:t}),re(n.messages)}function Ge(n,e,t,i=!1,s,r,o){n.messages.push({id:t||"srv-"+Date.now(),role:i?"operator":"agent",content:e,createdAt:new Date().toISOString(),attachments:s,operatorName:r,operatorAvatarUrl:o}),re(n.messages)}function hi(){var n;try{const e=Date.now(),t=JSON.parse((n=localStorage.getItem(Tt))!=null?n:"[]").filter(i=>e-i<ii);return t.length>=ni?!1:(t.push(e),localStorage.setItem(Tt,JSON.stringify(t)),!0)}catch(e){return!0}}function pi(){try{return localStorage.getItem(We)}catch(n){return null}}function ui(n){try{localStorage.setItem(We,n)}catch(e){}}function fi(n,e){if(e)try{localStorage.getItem(`${Et}_${n}`)!==e&&(localStorage.removeItem(Te),localStorage.setItem(`${Et}_${n}`,e))}catch(t){}}function mi(){try{const n=localStorage.getItem(Te);return n?JSON.parse(n):[]}catch(n){return[]}}function re(n){try{localStorage.setItem(Te,JSON.stringify(n.slice(-50)))}catch(e){}}function Ot(){try{const n=new(window.AudioContext||window.webkitAudioContext),e=n.createOscillator(),t=n.createGain();e.connect(t),t.connect(n.destination),e.type="sine",e.frequency.setValueAtTime(880,n.currentTime),e.frequency.setValueAtTime(1100,n.currentTime+.08),t.gain.setValueAtTime(.12,n.currentTime),t.gain.exponentialRampToValueAtTime(.001,n.currentTime+.35),e.start(n.currentTime),e.stop(n.currentTime+.35)}catch(n){}}function R(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function gi(n){if(!n)return null;const e=n.trim();return/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(e)?e:null}function Ct(n,e){let t=n.replace("#","");t.length===3&&(t=t.split("").map(o=>o+o).join(""));const i=parseInt(t.slice(0,2),16),s=parseInt(t.slice(2,4),16),r=parseInt(t.slice(4,6),16);return`rgba(${i}, ${s}, ${r}, ${e})`}function yi(n){if(n.mimeType.startsWith("image/")&&n.url)return`<a href="${H(n.url)}" target="_blank" rel="noopener noreferrer"><img class="lc-attach-img" src="${H(n.url)}" alt="${H(n.originalFilename)}" /></a>`;const t=vi(n.sizeBytes);return`<a class="lc-attach-file" href="${n.url?H(n.url):"#"}" target="_blank" rel="noopener noreferrer">${ki()}<span>${R(n.originalFilename)}</span><span class="lc-attach-size">${t}</span></a>`}function bi(n){return R(n).replace(/(https?:\/\/[^\s<]+)/g,i=>{const s=i.match(/[.,;:!?)]+$/),r=s?s[0]:"",o=r?i.slice(0,-r.length):i;return`<a href="${H(o)}" target="_blank" rel="noopener noreferrer nofollow">${o}</a>${r}`}).replace(/\n/g,"<br>")}function xi(n){let e=R(n);const t=[];return e=e.replace(/`([^`\n]+)`/g,(i,s)=>(t.push(`<code class="lc-md-code">${s}</code>`),`\0C${t.length-1}\0`)),e=e.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(i,s,r)=>`<a href="${H(r)}" target="_blank" rel="noopener noreferrer nofollow">${s}</a>`),e=e.replace(/\*\*([^*\n]+?)\*\*/g,"<strong>$1</strong>"),e=e.replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s.,;:!?)]|$)/g,"$1<em>$2</em>"),e=e.replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g,(i,s,r)=>{const o=r.match(/[.,;:!?)]+$/),c=o?o[0]:"",l=c?r.slice(0,-c.length):r;return`${s}<a href="${H(l)}" target="_blank" rel="noopener noreferrer nofollow">${l}</a>${c}`}),e=e.replace(/ C(\d+) /g,(i,s)=>{var r;return(r=t[Number(s)])!=null?r:""}),e=e.replace(/\n/g,"<br>"),e}function H(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function vi(n){return n<1024?`${n} B`:n<1024*1024?`${(n/1024).toFixed(0)} KB`:`${(n/1024/1024).toFixed(1)} MB`}function F(n,e,t=3500){const i=n.querySelector(".lc-toast");i&&(i.textContent=e,i.style.display="block",clearTimeout(i._timer),i._timer=setTimeout(()=>{i.style.display="none"},t))}function Qe(n){return n.trim().split(/\s+/).map(e=>{var t;return(t=e[0])!=null?t:""}).join("").slice(0,2).toUpperCase()}function wi(n){try{const e=new Date(n);return isNaN(e.getTime())?"":e.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}catch(e){return""}}function _i(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.58 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48"/></svg>'}function ki(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'}function Si(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'}function Ei(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'}function Rt(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'}function $t(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'}function Ti(){return'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>'}function Ii(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.36L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.36L3 16"/><path d="M3 21v-5h5"/></svg>'}function Ai(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'}function Li(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'}function Bt(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/></svg>'}function Oi(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'}function Ci(n,e){return!n.length&&(e!=null&&e.trim())?`<div class="lc-header-avatars"><div class="lc-op-avatar lc-op-initials" style="z-index:3">${R(Qe(e.trim()))}</div></div>`:n.length?`<div class="lc-header-avatars">${n.slice(0,3).map((s,r)=>{const o=r===0?"":"margin-left:-10px;",c=`z-index:${3-r};`;return s.avatarUrl?`<img class="lc-op-avatar" src="${H(s.avatarUrl)}" alt="${R(s.name)}" style="${c}${o}">`:`<div class="lc-op-avatar lc-op-initials" style="${c}${o}">${R(Qe(s.name))}</div>`}).join("")}</div>`:`<div class="lc-header-avatar">${Ei()}</div>`}let Nt="",fe=null,Le=null;const Ri=3e4;function $i(n){qt(n),Ni(n),window.addEventListener("popstate",()=>Ze(n)),window.addEventListener("pagehide",()=>{fe&&nt(n,fe)}),Bi(n)}function Bi(n){const e=()=>{document.visibilityState==="visible"&&Gt(n,{url:location.href,title:document.title})};setInterval(e,Ri),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&e()})}function Ni(n){const e={pushState:history.pushState,replaceState:history.replaceState};history.pushState=function(...t){const i=e.pushState.apply(this,t);return Ze(n),i},history.replaceState=function(...t){const i=e.replaceState.apply(this,t);return Ze(n),i}}function Ze(n){Le&&clearTimeout(Le),Le=setTimeout(()=>qt(n),300)}async function qt(n){var t;Le=null;const e=location.pathname+location.search;if(e!==Nt){Nt=e,fe&&nt(n,fe);try{fe=(t=(await Xt(n,{url:location.href,path:location.pathname,title:document.title,referrer:document.referrer,language:navigator.language})).pageviewId)!=null?t:null}catch(i){}}}const Pt="livechat_visitor_id";function qi(){const n=Pi();if(!n)return null;const e=n.getAttribute("data-site");if(!e)return null;const t=n.getAttribute("data-api")||Mi(n)||"",i=Di();let s;try{const r=n.getAttribute("data-context");r&&(s=JSON.parse(r))}catch(r){}try{const r=window.CortexLivechat;r!=null&&r.context&&typeof r.context=="object"&&(s=ee(ee({},s),r.context))}catch(r){}return{siteKey:e,visitorId:i,apiBase:t,context:s}}function Pi(){const n=document.querySelectorAll("script[data-site]");return n.length?n[n.length-1]:null}function Mi(n){if(!n.src)return null;try{const e=new URL(n.src);return`${e.protocol}//${e.host}`}catch(e){return null}}function Di(){try{const n=localStorage.getItem(Pt);if(n)return n;const e=Mt();return localStorage.setItem(Pt,e),e}catch(n){return Mt()}}function Mt(){if(typeof crypto!="undefined"&&crypto.randomUUID)return crypto.randomUUID();let n=Date.now();return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,e=>{const t=(n+Math.random()*16)%16|0;return n=Math.floor(n/16),(e==="x"?t:t&3|8).toString(16)})}const Dt="livechat_build",ji=["livechat_messages_cache","livechat_session_id","livechat_identify_dismissed","livechat_send_log","livechat_proactive_seen"];function Ui(){try{localStorage.getItem(Dt)!=="moyhq4gu"&&(ji.forEach(n=>localStorage.removeItem(n)),localStorage.setItem(Dt,"moyhq4gu"))}catch(n){}}(function(){var i;if(typeof window=="undefined"||(i=window.__livechat__)!=null&&i.mounted)return;Ui();const e=qi();if(!e)return;window.__livechat__={mounted:!0,siteKey:e.siteKey,visitorId:e.visitorId},$i(e);const t=async()=>{const s=await K(e);ri(e,s!=null?s:void 0)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",t):t()})()})();
