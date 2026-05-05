var Fi=Object.defineProperty,Vi=Object.defineProperties;var Ki=Object.getOwnPropertyDescriptors;var Gt=Object.getOwnPropertySymbols;var Yi=Object.prototype.hasOwnProperty,Wi=Object.prototype.propertyIsEnumerable;var Qt=(F,q,U)=>q in F?Fi(F,q,{enumerable:!0,configurable:!0,writable:!0,value:U}):F[q]=U,ee=(F,q)=>{for(var U in q||(q={}))Yi.call(q,U)&&Qt(F,U,q[U]);if(Gt)for(var U of Gt(q))Wi.call(q,U)&&Qt(F,U,q[U]);return F},le=(F,q)=>Vi(F,Ki(q));(function(){"use strict";async function F(n){try{const e=await fetch(`${n.apiBase}/livechat/config?siteKey=${encodeURIComponent(n.siteKey)}`,{method:"GET",credentials:"omit"});return e.ok?await e.json():null}catch(e){return null}}async function q(n,e,t){const i=new FormData;i.append("siteKey",n.siteKey),i.append("visitorId",n.visitorId),i.append("sessionId",e),i.append("file",t,t.name);const s=await fetch(`${n.apiBase}/livechat/upload`,{method:"POST",body:i,credentials:"omit"});if(!s.ok){const r=await s.text().catch(()=>"");throw new Error(`${s.status} ${s.statusText}${r?` — ${r}`:""}`)}return s.json()}async function U(n,e){const t=await fetch(n,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e),credentials:"omit"});if(!t.ok){const i=await t.text().catch(()=>"");throw new Error(`${t.status} ${t.statusText}${i?` — ${i}`:""}`)}return t.json()}function it(n,e){return U(`${n.apiBase}/livechat/track/pageview`,ee({siteKey:n.siteKey,visitorId:n.visitorId},e))}function st(n,e){return U(`${n.apiBase}/livechat/track/heartbeat`,{siteKey:n.siteKey,visitorId:n.visitorId,url:e.url,title:e.title}).catch(()=>{})}function $e(n,e){const t=`${n.apiBase}/livechat/track/leave`,i=JSON.stringify({siteKey:n.siteKey,visitorId:n.visitorId,pageviewId:e});if(navigator.sendBeacon){const s=new Blob([i],{type:"application/json"});navigator.sendBeacon(t,s);return}fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:i,keepalive:!0}).catch(()=>{})}function rt(n,e,t,i,s,r,o){return U(`${n.apiBase}/livechat/message`,{siteKey:n.siteKey,visitorId:n.visitorId,content:e,attachmentIds:t&&t.length?t:void 0,meta:i,pageContext:s,replyToId:r||void 0,replyToContent:o||void 0})}function Be(n,e){return U(`${n.apiBase}/livechat/identify`,{siteKey:n.siteKey,visitorId:n.visitorId,email:e.email,name:e.name})}const Zt=Object.freeze(Object.defineProperty({__proto__:null,fetchSiteConfig:F,identify:Be,sendMessage:rt,trackHeartbeat:st,trackLeave:$e,trackPageview:it,uploadAttachment:q},Symbol.toStringTag,{value:"Module"})),J=Object.create(null);J.open="0",J.close="1",J.ping="2",J.pong="3",J.message="4",J.upgrade="5",J.noop="6";const be=Object.create(null);Object.keys(J).forEach(n=>{be[J[n]]=n});const Ne={type:"error",data:"parser error"},ot=typeof Blob=="function"||typeof Blob!="undefined"&&Object.prototype.toString.call(Blob)==="[object BlobConstructor]",at=typeof ArrayBuffer=="function",ct=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n&&n.buffer instanceof ArrayBuffer,qe=({type:n,data:e},t,i)=>ot&&e instanceof Blob?t?i(e):lt(e,i):at&&(e instanceof ArrayBuffer||ct(e))?t?i(e):lt(new Blob([e]),i):i(J[n]+(e||"")),lt=(n,e)=>{const t=new FileReader;return t.onload=function(){const i=t.result.split(",")[1];e("b"+(i||""))},t.readAsDataURL(n)};function dt(n){return n instanceof Uint8Array?n:n instanceof ArrayBuffer?new Uint8Array(n):new Uint8Array(n.buffer,n.byteOffset,n.byteLength)}let Pe;function en(n,e){if(ot&&n.data instanceof Blob)return n.data.arrayBuffer().then(dt).then(e);if(at&&(n.data instanceof ArrayBuffer||ct(n.data)))return e(dt(n.data));qe(n,!1,t=>{Pe||(Pe=new TextEncoder),e(Pe.encode(t))})}const ht="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",de=typeof Uint8Array=="undefined"?[]:new Uint8Array(256);for(let n=0;n<ht.length;n++)de[ht.charCodeAt(n)]=n;const tn=n=>{let e=n.length*.75,t=n.length,i,s=0,r,o,c,l;n[n.length-1]==="="&&(e--,n[n.length-2]==="="&&e--);const y=new ArrayBuffer(e),x=new Uint8Array(y);for(i=0;i<t;i+=4)r=de[n.charCodeAt(i)],o=de[n.charCodeAt(i+1)],c=de[n.charCodeAt(i+2)],l=de[n.charCodeAt(i+3)],x[s++]=r<<2|o>>4,x[s++]=(o&15)<<4|c>>2,x[s++]=(c&3)<<6|l&63;return y},nn=typeof ArrayBuffer=="function",Me=(n,e)=>{if(typeof n!="string")return{type:"message",data:pt(n,e)};const t=n.charAt(0);return t==="b"?{type:"message",data:sn(n.substring(1),e)}:be[t]?n.length>1?{type:be[t],data:n.substring(1)}:{type:be[t]}:Ne},sn=(n,e)=>{if(nn){const t=tn(n);return pt(t,e)}else return{base64:!0,data:n}},pt=(n,e)=>{switch(e){case"blob":return n instanceof Blob?n:new Blob([n]);case"arraybuffer":default:return n instanceof ArrayBuffer?n:n.buffer}},ut="",rn=(n,e)=>{const t=n.length,i=new Array(t);let s=0;n.forEach((r,o)=>{qe(r,!1,c=>{i[o]=c,++s===t&&e(i.join(ut))})})},on=(n,e)=>{const t=n.split(ut),i=[];for(let s=0;s<t.length;s++){const r=Me(t[s],e);if(i.push(r),r.type==="error")break}return i};function an(){return new TransformStream({transform(n,e){en(n,t=>{const i=t.length;let s;if(i<126)s=new Uint8Array(1),new DataView(s.buffer).setUint8(0,i);else if(i<65536){s=new Uint8Array(3);const r=new DataView(s.buffer);r.setUint8(0,126),r.setUint16(1,i)}else{s=new Uint8Array(9);const r=new DataView(s.buffer);r.setUint8(0,127),r.setBigUint64(1,BigInt(i))}n.data&&typeof n.data!="string"&&(s[0]|=128),e.enqueue(s),e.enqueue(t)})}})}let De;function xe(n){return n.reduce((e,t)=>e+t.length,0)}function ve(n,e){if(n[0].length===e)return n.shift();const t=new Uint8Array(e);let i=0;for(let s=0;s<e;s++)t[s]=n[0][i++],i===n[0].length&&(n.shift(),i=0);return n.length&&i<n[0].length&&(n[0]=n[0].slice(i)),t}function cn(n,e){De||(De=new TextDecoder);const t=[];let i=0,s=-1,r=!1;return new TransformStream({transform(o,c){for(t.push(o);;){if(i===0){if(xe(t)<1)break;const l=ve(t,1);r=(l[0]&128)===128,s=l[0]&127,s<126?i=3:s===126?i=1:i=2}else if(i===1){if(xe(t)<2)break;const l=ve(t,2);s=new DataView(l.buffer,l.byteOffset,l.length).getUint16(0),i=3}else if(i===2){if(xe(t)<8)break;const l=ve(t,8),y=new DataView(l.buffer,l.byteOffset,l.length),x=y.getUint32(0);if(x>Math.pow(2,21)-1){c.enqueue(Ne);break}s=x*Math.pow(2,32)+y.getUint32(4),i=3}else{if(xe(t)<s)break;const l=ve(t,s);c.enqueue(Me(r?l:De.decode(l),e)),i=0}if(s===0||s>n){c.enqueue(Ne);break}}}})}const ft=4;function O(n){if(n)return ln(n)}function ln(n){for(var e in O.prototype)n[e]=O.prototype[e];return n}O.prototype.on=O.prototype.addEventListener=function(n,e){return this._callbacks=this._callbacks||{},(this._callbacks["$"+n]=this._callbacks["$"+n]||[]).push(e),this},O.prototype.once=function(n,e){function t(){this.off(n,t),e.apply(this,arguments)}return t.fn=e,this.on(n,t),this},O.prototype.off=O.prototype.removeListener=O.prototype.removeAllListeners=O.prototype.removeEventListener=function(n,e){if(this._callbacks=this._callbacks||{},arguments.length==0)return this._callbacks={},this;var t=this._callbacks["$"+n];if(!t)return this;if(arguments.length==1)return delete this._callbacks["$"+n],this;for(var i,s=0;s<t.length;s++)if(i=t[s],i===e||i.fn===e){t.splice(s,1);break}return t.length===0&&delete this._callbacks["$"+n],this},O.prototype.emit=function(n){this._callbacks=this._callbacks||{};for(var e=new Array(arguments.length-1),t=this._callbacks["$"+n],i=1;i<arguments.length;i++)e[i-1]=arguments[i];if(t){t=t.slice(0);for(var i=0,s=t.length;i<s;++i)t[i].apply(this,e)}return this},O.prototype.emitReserved=O.prototype.emit,O.prototype.listeners=function(n){return this._callbacks=this._callbacks||{},this._callbacks["$"+n]||[]},O.prototype.hasListeners=function(n){return!!this.listeners(n).length};const we=typeof Promise=="function"&&typeof Promise.resolve=="function"?e=>Promise.resolve().then(e):(e,t)=>t(e,0),V=typeof self!="undefined"?self:typeof window!="undefined"?window:Function("return this")(),dn="arraybuffer";function Ji(){}function mt(n,...e){return e.reduce((t,i)=>(n.hasOwnProperty(i)&&(t[i]=n[i]),t),{})}const hn=V.setTimeout,pn=V.clearTimeout;function _e(n,e){e.useNativeTimers?(n.setTimeoutFn=hn.bind(V),n.clearTimeoutFn=pn.bind(V)):(n.setTimeoutFn=V.setTimeout.bind(V),n.clearTimeoutFn=V.clearTimeout.bind(V))}const un=1.33;function fn(n){return typeof n=="string"?mn(n):Math.ceil((n.byteLength||n.size)*un)}function mn(n){let e=0,t=0;for(let i=0,s=n.length;i<s;i++)e=n.charCodeAt(i),e<128?t+=1:e<2048?t+=2:e<55296||e>=57344?t+=3:(i++,t+=4);return t}function gt(){return Date.now().toString(36).substring(3)+Math.random().toString(36).substring(2,5)}function gn(n){let e="";for(let t in n)n.hasOwnProperty(t)&&(e.length&&(e+="&"),e+=encodeURIComponent(t)+"="+encodeURIComponent(n[t]));return e}function yn(n){let e={},t=n.split("&");for(let i=0,s=t.length;i<s;i++){let r=t[i].split("=");e[decodeURIComponent(r[0])]=decodeURIComponent(r[1])}return e}class bn extends Error{constructor(e,t,i){super(e),this.description=t,this.context=i,this.type="TransportError"}}class je extends O{constructor(e){super(),this.writable=!1,_e(this,e),this.opts=e,this.query=e.query,this.socket=e.socket,this.supportsBinary=!e.forceBase64}onError(e,t,i){return super.emitReserved("error",new bn(e,t,i)),this}open(){return this.readyState="opening",this.doOpen(),this}close(){return(this.readyState==="opening"||this.readyState==="open")&&(this.doClose(),this.onClose()),this}send(e){this.readyState==="open"&&this.write(e)}onOpen(){this.readyState="open",this.writable=!0,super.emitReserved("open")}onData(e){const t=Me(e,this.socket.binaryType);this.onPacket(t)}onPacket(e){super.emitReserved("packet",e)}onClose(e){this.readyState="closed",super.emitReserved("close",e)}pause(e){}createUri(e,t={}){return e+"://"+this._hostname()+this._port()+this.opts.path+this._query(t)}_hostname(){const e=this.opts.hostname;return e.indexOf(":")===-1?e:"["+e+"]"}_port(){return this.opts.port&&(this.opts.secure&&Number(this.opts.port)!==443||!this.opts.secure&&Number(this.opts.port)!==80)?":"+this.opts.port:""}_query(e){const t=gn(e);return t.length?"?"+t:""}}class xn extends je{constructor(){super(...arguments),this._polling=!1}get name(){return"polling"}doOpen(){this._poll()}pause(e){this.readyState="pausing";const t=()=>{this.readyState="paused",e()};if(this._polling||!this.writable){let i=0;this._polling&&(i++,this.once("pollComplete",function(){--i||t()})),this.writable||(i++,this.once("drain",function(){--i||t()}))}else t()}_poll(){this._polling=!0,this.doPoll(),this.emitReserved("poll")}onData(e){const t=i=>{if(this.readyState==="opening"&&i.type==="open"&&this.onOpen(),i.type==="close")return this.onClose({description:"transport closed by the server"}),!1;this.onPacket(i)};on(e,this.socket.binaryType).forEach(t),this.readyState!=="closed"&&(this._polling=!1,this.emitReserved("pollComplete"),this.readyState==="open"&&this._poll())}doClose(){const e=()=>{this.write([{type:"close"}])};this.readyState==="open"?e():this.once("open",e)}write(e){this.writable=!1,rn(e,t=>{this.doWrite(t,()=>{this.writable=!0,this.emitReserved("drain")})})}uri(){const e=this.opts.secure?"https":"http",t=this.query||{};return this.opts.timestampRequests!==!1&&(t[this.opts.timestampParam]=gt()),!this.supportsBinary&&!t.sid&&(t.b64=1),this.createUri(e,t)}}let yt=!1;try{yt=typeof XMLHttpRequest!="undefined"&&"withCredentials"in new XMLHttpRequest}catch(n){}const vn=yt;function wn(){}class _n extends xn{constructor(e){if(super(e),typeof location!="undefined"){const t=location.protocol==="https:";let i=location.port;i||(i=t?"443":"80"),this.xd=typeof location!="undefined"&&e.hostname!==location.hostname||i!==e.port}}doWrite(e,t){const i=this.request({method:"POST",data:e});i.on("success",t),i.on("error",(s,r)=>{this.onError("xhr post error",s,r)})}doPoll(){const e=this.request();e.on("data",this.onData.bind(this)),e.on("error",(t,i)=>{this.onError("xhr poll error",t,i)}),this.pollXhr=e}}class X extends O{constructor(e,t,i){super(),this.createRequest=e,_e(this,i),this._opts=i,this._method=i.method||"GET",this._uri=t,this._data=i.data!==void 0?i.data:null,this._create()}_create(){var e;const t=mt(this._opts,"agent","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","autoUnref");t.xdomain=!!this._opts.xd;const i=this._xhr=this.createRequest(t);try{i.open(this._method,this._uri,!0);try{if(this._opts.extraHeaders){i.setDisableHeaderCheck&&i.setDisableHeaderCheck(!0);for(let s in this._opts.extraHeaders)this._opts.extraHeaders.hasOwnProperty(s)&&i.setRequestHeader(s,this._opts.extraHeaders[s])}}catch(s){}if(this._method==="POST")try{i.setRequestHeader("Content-type","text/plain;charset=UTF-8")}catch(s){}try{i.setRequestHeader("Accept","*/*")}catch(s){}(e=this._opts.cookieJar)===null||e===void 0||e.addCookies(i),"withCredentials"in i&&(i.withCredentials=this._opts.withCredentials),this._opts.requestTimeout&&(i.timeout=this._opts.requestTimeout),i.onreadystatechange=()=>{var s;i.readyState===3&&((s=this._opts.cookieJar)===null||s===void 0||s.parseCookies(i.getResponseHeader("set-cookie"))),i.readyState===4&&(i.status===200||i.status===1223?this._onLoad():this.setTimeoutFn(()=>{this._onError(typeof i.status=="number"?i.status:0)},0))},i.send(this._data)}catch(s){this.setTimeoutFn(()=>{this._onError(s)},0);return}typeof document!="undefined"&&(this._index=X.requestsCount++,X.requests[this._index]=this)}_onError(e){this.emitReserved("error",e,this._xhr),this._cleanup(!0)}_cleanup(e){if(!(typeof this._xhr=="undefined"||this._xhr===null)){if(this._xhr.onreadystatechange=wn,e)try{this._xhr.abort()}catch(t){}typeof document!="undefined"&&delete X.requests[this._index],this._xhr=null}}_onLoad(){const e=this._xhr.responseText;e!==null&&(this.emitReserved("data",e),this.emitReserved("success"),this._cleanup())}abort(){this._cleanup()}}if(X.requestsCount=0,X.requests={},typeof document!="undefined"){if(typeof attachEvent=="function")attachEvent("onunload",bt);else if(typeof addEventListener=="function"){const n="onpagehide"in V?"pagehide":"unload";addEventListener(n,bt,!1)}}function bt(){for(let n in X.requests)X.requests.hasOwnProperty(n)&&X.requests[n].abort()}const kn=(function(){const n=xt({xdomain:!1});return n&&n.responseType!==null})();class Sn extends _n{constructor(e){super(e);const t=e&&e.forceBase64;this.supportsBinary=kn&&!t}request(e={}){return Object.assign(e,{xd:this.xd},this.opts),new X(xt,this.uri(),e)}}function xt(n){const e=n.xdomain;try{if(typeof XMLHttpRequest!="undefined"&&(!e||vn))return new XMLHttpRequest}catch(t){}if(!e)try{return new V[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP")}catch(t){}}const vt=typeof navigator!="undefined"&&typeof navigator.product=="string"&&navigator.product.toLowerCase()==="reactnative";class En extends je{get name(){return"websocket"}doOpen(){const e=this.uri(),t=this.opts.protocols,i=vt?{}:mt(this.opts,"agent","perMessageDeflate","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","localAddress","protocolVersion","origin","maxPayload","family","checkServerIdentity");this.opts.extraHeaders&&(i.headers=this.opts.extraHeaders);try{this.ws=this.createSocket(e,t,i)}catch(s){return this.emitReserved("error",s)}this.ws.binaryType=this.socket.binaryType,this.addEventListeners()}addEventListeners(){this.ws.onopen=()=>{this.opts.autoUnref&&this.ws._socket.unref(),this.onOpen()},this.ws.onclose=e=>this.onClose({description:"websocket connection closed",context:e}),this.ws.onmessage=e=>this.onData(e.data),this.ws.onerror=e=>this.onError("websocket error",e)}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const i=e[t],s=t===e.length-1;qe(i,this.supportsBinary,r=>{try{this.doWrite(i,r)}catch(o){}s&&we(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){typeof this.ws!="undefined"&&(this.ws.onerror=()=>{},this.ws.close(),this.ws=null)}uri(){const e=this.opts.secure?"wss":"ws",t=this.query||{};return this.opts.timestampRequests&&(t[this.opts.timestampParam]=gt()),this.supportsBinary||(t.b64=1),this.createUri(e,t)}}const ze=V.WebSocket||V.MozWebSocket;class Tn extends En{createSocket(e,t,i){return vt?new ze(e,t,i):t?new ze(e,t):new ze(e)}doWrite(e,t){this.ws.send(t)}}class In extends je{get name(){return"webtransport"}doOpen(){try{this._transport=new WebTransport(this.createUri("https"),this.opts.transportOptions[this.name])}catch(e){return this.emitReserved("error",e)}this._transport.closed.then(()=>{this.onClose()}).catch(e=>{this.onError("webtransport error",e)}),this._transport.ready.then(()=>{this._transport.createBidirectionalStream().then(e=>{const t=cn(Number.MAX_SAFE_INTEGER,this.socket.binaryType),i=e.readable.pipeThrough(t).getReader(),s=an();s.readable.pipeTo(e.writable),this._writer=s.writable.getWriter();const r=()=>{i.read().then(({done:c,value:l})=>{c||(this.onPacket(l),r())}).catch(c=>{})};r();const o={type:"open"};this.query.sid&&(o.data=`{"sid":"${this.query.sid}"}`),this._writer.write(o).then(()=>this.onOpen())})})}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const i=e[t],s=t===e.length-1;this._writer.write(i).then(()=>{s&&we(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){var e;(e=this._transport)===null||e===void 0||e.close()}}const An={websocket:Tn,webtransport:In,polling:Sn},Ln=/^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,On=["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"];function Ue(n){if(n.length>8e3)throw"URI too long";const e=n,t=n.indexOf("["),i=n.indexOf("]");t!=-1&&i!=-1&&(n=n.substring(0,t)+n.substring(t,i).replace(/:/g,";")+n.substring(i,n.length));let s=Ln.exec(n||""),r={},o=14;for(;o--;)r[On[o]]=s[o]||"";return t!=-1&&i!=-1&&(r.source=e,r.host=r.host.substring(1,r.host.length-1).replace(/;/g,":"),r.authority=r.authority.replace("[","").replace("]","").replace(/;/g,":"),r.ipv6uri=!0),r.pathNames=Cn(r,r.path),r.queryKey=Rn(r,r.query),r}function Cn(n,e){const t=/\/{2,9}/g,i=e.replace(t,"/").split("/");return(e.slice(0,1)=="/"||e.length===0)&&i.splice(0,1),e.slice(-1)=="/"&&i.splice(i.length-1,1),i}function Rn(n,e){const t={};return e.replace(/(?:^|&)([^&=]*)=?([^&]*)/g,function(i,s,r){s&&(t[s]=r)}),t}const He=typeof addEventListener=="function"&&typeof removeEventListener=="function",ke=[];He&&addEventListener("offline",()=>{ke.forEach(n=>n())},!1);class te extends O{constructor(e,t){if(super(),this.binaryType=dn,this.writeBuffer=[],this._prevBufferLen=0,this._pingInterval=-1,this._pingTimeout=-1,this._maxPayload=-1,this._pingTimeoutTime=1/0,e&&typeof e=="object"&&(t=e,e=null),e){const i=Ue(e);t.hostname=i.host,t.secure=i.protocol==="https"||i.protocol==="wss",t.port=i.port,i.query&&(t.query=i.query)}else t.host&&(t.hostname=Ue(t.host).host);_e(this,t),this.secure=t.secure!=null?t.secure:typeof location!="undefined"&&location.protocol==="https:",t.hostname&&!t.port&&(t.port=this.secure?"443":"80"),this.hostname=t.hostname||(typeof location!="undefined"?location.hostname:"localhost"),this.port=t.port||(typeof location!="undefined"&&location.port?location.port:this.secure?"443":"80"),this.transports=[],this._transportsByName={},t.transports.forEach(i=>{const s=i.prototype.name;this.transports.push(s),this._transportsByName[s]=i}),this.opts=Object.assign({path:"/engine.io",agent:!1,withCredentials:!1,upgrade:!0,timestampParam:"t",rememberUpgrade:!1,addTrailingSlash:!0,rejectUnauthorized:!0,perMessageDeflate:{threshold:1024},transportOptions:{},closeOnBeforeunload:!1},t),this.opts.path=this.opts.path.replace(/\/$/,"")+(this.opts.addTrailingSlash?"/":""),typeof this.opts.query=="string"&&(this.opts.query=yn(this.opts.query)),He&&(this.opts.closeOnBeforeunload&&(this._beforeunloadEventListener=()=>{this.transport&&(this.transport.removeAllListeners(),this.transport.close())},addEventListener("beforeunload",this._beforeunloadEventListener,!1)),this.hostname!=="localhost"&&(this._offlineEventListener=()=>{this._onClose("transport close",{description:"network connection lost"})},ke.push(this._offlineEventListener))),this.opts.withCredentials&&(this._cookieJar=void 0),this._open()}createTransport(e){const t=Object.assign({},this.opts.query);t.EIO=ft,t.transport=e,this.id&&(t.sid=this.id);const i=Object.assign({},this.opts,{query:t,socket:this,hostname:this.hostname,secure:this.secure,port:this.port},this.opts.transportOptions[e]);return new this._transportsByName[e](i)}_open(){if(this.transports.length===0){this.setTimeoutFn(()=>{this.emitReserved("error","No transports available")},0);return}const e=this.opts.rememberUpgrade&&te.priorWebsocketSuccess&&this.transports.indexOf("websocket")!==-1?"websocket":this.transports[0];this.readyState="opening";const t=this.createTransport(e);t.open(),this.setTransport(t)}setTransport(e){this.transport&&this.transport.removeAllListeners(),this.transport=e,e.on("drain",this._onDrain.bind(this)).on("packet",this._onPacket.bind(this)).on("error",this._onError.bind(this)).on("close",t=>this._onClose("transport close",t))}onOpen(){this.readyState="open",te.priorWebsocketSuccess=this.transport.name==="websocket",this.emitReserved("open"),this.flush()}_onPacket(e){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing")switch(this.emitReserved("packet",e),this.emitReserved("heartbeat"),e.type){case"open":this.onHandshake(JSON.parse(e.data));break;case"ping":this._sendPacket("pong"),this.emitReserved("ping"),this.emitReserved("pong"),this._resetPingTimeout();break;case"error":const t=new Error("server error");t.code=e.data,this._onError(t);break;case"message":this.emitReserved("data",e.data),this.emitReserved("message",e.data);break}}onHandshake(e){this.emitReserved("handshake",e),this.id=e.sid,this.transport.query.sid=e.sid,this._pingInterval=e.pingInterval,this._pingTimeout=e.pingTimeout,this._maxPayload=e.maxPayload,this.onOpen(),this.readyState!=="closed"&&this._resetPingTimeout()}_resetPingTimeout(){this.clearTimeoutFn(this._pingTimeoutTimer);const e=this._pingInterval+this._pingTimeout;this._pingTimeoutTime=Date.now()+e,this._pingTimeoutTimer=this.setTimeoutFn(()=>{this._onClose("ping timeout")},e),this.opts.autoUnref&&this._pingTimeoutTimer.unref()}_onDrain(){this.writeBuffer.splice(0,this._prevBufferLen),this._prevBufferLen=0,this.writeBuffer.length===0?this.emitReserved("drain"):this.flush()}flush(){if(this.readyState!=="closed"&&this.transport.writable&&!this.upgrading&&this.writeBuffer.length){const e=this._getWritablePackets();this.transport.send(e),this._prevBufferLen=e.length,this.emitReserved("flush")}}_getWritablePackets(){if(!(this._maxPayload&&this.transport.name==="polling"&&this.writeBuffer.length>1))return this.writeBuffer;let t=1;for(let i=0;i<this.writeBuffer.length;i++){const s=this.writeBuffer[i].data;if(s&&(t+=fn(s)),i>0&&t>this._maxPayload)return this.writeBuffer.slice(0,i);t+=2}return this.writeBuffer}_hasPingExpired(){if(!this._pingTimeoutTime)return!0;const e=Date.now()>this._pingTimeoutTime;return e&&(this._pingTimeoutTime=0,we(()=>{this._onClose("ping timeout")},this.setTimeoutFn)),e}write(e,t,i){return this._sendPacket("message",e,t,i),this}send(e,t,i){return this._sendPacket("message",e,t,i),this}_sendPacket(e,t,i,s){if(typeof t=="function"&&(s=t,t=void 0),typeof i=="function"&&(s=i,i=null),this.readyState==="closing"||this.readyState==="closed")return;i=i||{},i.compress=i.compress!==!1;const r={type:e,data:t,options:i};this.emitReserved("packetCreate",r),this.writeBuffer.push(r),s&&this.once("flush",s),this.flush()}close(){const e=()=>{this._onClose("forced close"),this.transport.close()},t=()=>{this.off("upgrade",t),this.off("upgradeError",t),e()},i=()=>{this.once("upgrade",t),this.once("upgradeError",t)};return(this.readyState==="opening"||this.readyState==="open")&&(this.readyState="closing",this.writeBuffer.length?this.once("drain",()=>{this.upgrading?i():e()}):this.upgrading?i():e()),this}_onError(e){if(te.priorWebsocketSuccess=!1,this.opts.tryAllTransports&&this.transports.length>1&&this.readyState==="opening")return this.transports.shift(),this._open();this.emitReserved("error",e),this._onClose("transport error",e)}_onClose(e,t){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing"){if(this.clearTimeoutFn(this._pingTimeoutTimer),this.transport.removeAllListeners("close"),this.transport.close(),this.transport.removeAllListeners(),He&&(this._beforeunloadEventListener&&removeEventListener("beforeunload",this._beforeunloadEventListener,!1),this._offlineEventListener)){const i=ke.indexOf(this._offlineEventListener);i!==-1&&ke.splice(i,1)}this.readyState="closed",this.id=null,this.emitReserved("close",e,t),this.writeBuffer=[],this._prevBufferLen=0}}}te.protocol=ft;class $n extends te{constructor(){super(...arguments),this._upgrades=[]}onOpen(){if(super.onOpen(),this.readyState==="open"&&this.opts.upgrade)for(let e=0;e<this._upgrades.length;e++)this._probe(this._upgrades[e])}_probe(e){let t=this.createTransport(e),i=!1;te.priorWebsocketSuccess=!1;const s=()=>{i||(t.send([{type:"ping",data:"probe"}]),t.once("packet",I=>{if(!i)if(I.type==="pong"&&I.data==="probe"){if(this.upgrading=!0,this.emitReserved("upgrading",t),!t)return;te.priorWebsocketSuccess=t.name==="websocket",this.transport.pause(()=>{i||this.readyState!=="closed"&&(x(),this.setTransport(t),t.send([{type:"upgrade"}]),this.emitReserved("upgrade",t),t=null,this.upgrading=!1,this.flush())})}else{const g=new Error("probe error");g.transport=t.name,this.emitReserved("upgradeError",g)}}))};function r(){i||(i=!0,x(),t.close(),t=null)}const o=I=>{const g=new Error("probe error: "+I);g.transport=t.name,r(),this.emitReserved("upgradeError",g)};function c(){o("transport closed")}function l(){o("socket closed")}function y(I){t&&I.name!==t.name&&r()}const x=()=>{t.removeListener("open",s),t.removeListener("error",o),t.removeListener("close",c),this.off("close",l),this.off("upgrading",y)};t.once("open",s),t.once("error",o),t.once("close",c),this.once("close",l),this.once("upgrading",y),this._upgrades.indexOf("webtransport")!==-1&&e!=="webtransport"?this.setTimeoutFn(()=>{i||t.open()},200):t.open()}onHandshake(e){this._upgrades=this._filterUpgrades(e.upgrades),super.onHandshake(e)}_filterUpgrades(e){const t=[];for(let i=0;i<e.length;i++)~this.transports.indexOf(e[i])&&t.push(e[i]);return t}}let Bn=class extends $n{constructor(e,t={}){const i=typeof e=="object"?e:t;(!i.transports||i.transports&&typeof i.transports[0]=="string")&&(i.transports=(i.transports||["polling","websocket","webtransport"]).map(s=>An[s]).filter(s=>!!s)),super(e,i)}};function Nn(n,e="",t){let i=n;t=t||typeof location!="undefined"&&location,n==null&&(n=t.protocol+"//"+t.host),typeof n=="string"&&(n.charAt(0)==="/"&&(n.charAt(1)==="/"?n=t.protocol+n:n=t.host+n),/^(https?|wss?):\/\//.test(n)||(typeof t!="undefined"?n=t.protocol+"//"+n:n="https://"+n),i=Ue(n)),i.port||(/^(http|ws)$/.test(i.protocol)?i.port="80":/^(http|ws)s$/.test(i.protocol)&&(i.port="443")),i.path=i.path||"/";const r=i.host.indexOf(":")!==-1?"["+i.host+"]":i.host;return i.id=i.protocol+"://"+r+":"+i.port+e,i.href=i.protocol+"://"+r+(t&&t.port===i.port?"":":"+i.port),i}const qn=typeof ArrayBuffer=="function",Pn=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n.buffer instanceof ArrayBuffer,wt=Object.prototype.toString,Mn=typeof Blob=="function"||typeof Blob!="undefined"&&wt.call(Blob)==="[object BlobConstructor]",Dn=typeof File=="function"||typeof File!="undefined"&&wt.call(File)==="[object FileConstructor]";function Fe(n){return qn&&(n instanceof ArrayBuffer||Pn(n))||Mn&&n instanceof Blob||Dn&&n instanceof File}function Se(n,e){if(!n||typeof n!="object")return!1;if(Array.isArray(n)){for(let t=0,i=n.length;t<i;t++)if(Se(n[t]))return!0;return!1}if(Fe(n))return!0;if(n.toJSON&&typeof n.toJSON=="function"&&arguments.length===1)return Se(n.toJSON(),!0);for(const t in n)if(Object.prototype.hasOwnProperty.call(n,t)&&Se(n[t]))return!0;return!1}function jn(n){const e=[],t=n.data,i=n;return i.data=Ve(t,e),i.attachments=e.length,{packet:i,buffers:e}}function Ve(n,e){if(!n)return n;if(Fe(n)){const t={_placeholder:!0,num:e.length};return e.push(n),t}else if(Array.isArray(n)){const t=new Array(n.length);for(let i=0;i<n.length;i++)t[i]=Ve(n[i],e);return t}else if(typeof n=="object"&&!(n instanceof Date)){const t={};for(const i in n)Object.prototype.hasOwnProperty.call(n,i)&&(t[i]=Ve(n[i],e));return t}return n}function zn(n,e){return n.data=Ke(n.data,e),delete n.attachments,n}function Ke(n,e){if(!n)return n;if(n&&n._placeholder===!0){if(typeof n.num=="number"&&n.num>=0&&n.num<e.length)return e[n.num];throw new Error("illegal attachments")}else if(Array.isArray(n))for(let t=0;t<n.length;t++)n[t]=Ke(n[t],e);else if(typeof n=="object")for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&(n[t]=Ke(n[t],e));return n}const Un=["connect","connect_error","disconnect","disconnecting","newListener","removeListener"];var b;(function(n){n[n.CONNECT=0]="CONNECT",n[n.DISCONNECT=1]="DISCONNECT",n[n.EVENT=2]="EVENT",n[n.ACK=3]="ACK",n[n.CONNECT_ERROR=4]="CONNECT_ERROR",n[n.BINARY_EVENT=5]="BINARY_EVENT",n[n.BINARY_ACK=6]="BINARY_ACK"})(b||(b={}));class Hn{constructor(e){this.replacer=e}encode(e){return(e.type===b.EVENT||e.type===b.ACK)&&Se(e)?this.encodeAsBinary({type:e.type===b.EVENT?b.BINARY_EVENT:b.BINARY_ACK,nsp:e.nsp,data:e.data,id:e.id}):[this.encodeAsString(e)]}encodeAsString(e){let t=""+e.type;return(e.type===b.BINARY_EVENT||e.type===b.BINARY_ACK)&&(t+=e.attachments+"-"),e.nsp&&e.nsp!=="/"&&(t+=e.nsp+","),e.id!=null&&(t+=e.id),e.data!=null&&(t+=JSON.stringify(e.data,this.replacer)),t}encodeAsBinary(e){const t=jn(e),i=this.encodeAsString(t.packet),s=t.buffers;return s.unshift(i),s}}class Ye extends O{constructor(e){super(),this.opts=Object.assign({reviver:void 0,maxAttachments:10},typeof e=="function"?{reviver:e}:e)}add(e){let t;if(typeof e=="string"){if(this.reconstructor)throw new Error("got plaintext data when reconstructing a packet");t=this.decodeString(e);const i=t.type===b.BINARY_EVENT;i||t.type===b.BINARY_ACK?(t.type=i?b.EVENT:b.ACK,this.reconstructor=new Fn(t),t.attachments===0&&super.emitReserved("decoded",t)):super.emitReserved("decoded",t)}else if(Fe(e)||e.base64)if(this.reconstructor)t=this.reconstructor.takeBinaryData(e),t&&(this.reconstructor=null,super.emitReserved("decoded",t));else throw new Error("got binary data when not reconstructing a packet");else throw new Error("Unknown type: "+e)}decodeString(e){let t=0;const i={type:Number(e.charAt(0))};if(b[i.type]===void 0)throw new Error("unknown packet type "+i.type);if(i.type===b.BINARY_EVENT||i.type===b.BINARY_ACK){const r=t+1;for(;e.charAt(++t)!=="-"&&t!=e.length;);const o=e.substring(r,t);if(o!=Number(o)||e.charAt(t)!=="-")throw new Error("Illegal attachments");const c=Number(o);if(!Vn(c)||c<0)throw new Error("Illegal attachments");if(c>this.opts.maxAttachments)throw new Error("too many attachments");i.attachments=c}if(e.charAt(t+1)==="/"){const r=t+1;for(;++t&&!(e.charAt(t)===","||t===e.length););i.nsp=e.substring(r,t)}else i.nsp="/";const s=e.charAt(t+1);if(s!==""&&Number(s)==s){const r=t+1;for(;++t;){const o=e.charAt(t);if(o==null||Number(o)!=o){--t;break}if(t===e.length)break}i.id=Number(e.substring(r,t+1))}if(e.charAt(++t)){const r=this.tryParse(e.substr(t));if(Ye.isPayloadValid(i.type,r))i.data=r;else throw new Error("invalid payload")}return i}tryParse(e){try{return JSON.parse(e,this.opts.reviver)}catch(t){return!1}}static isPayloadValid(e,t){switch(e){case b.CONNECT:return _t(t);case b.DISCONNECT:return t===void 0;case b.CONNECT_ERROR:return typeof t=="string"||_t(t);case b.EVENT:case b.BINARY_EVENT:return Array.isArray(t)&&(typeof t[0]=="number"||typeof t[0]=="string"&&Un.indexOf(t[0])===-1);case b.ACK:case b.BINARY_ACK:return Array.isArray(t)}}destroy(){this.reconstructor&&(this.reconstructor.finishedReconstruction(),this.reconstructor=null)}}class Fn{constructor(e){this.packet=e,this.buffers=[],this.reconPack=e}takeBinaryData(e){if(this.buffers.push(e),this.buffers.length===this.reconPack.attachments){const t=zn(this.reconPack,this.buffers);return this.finishedReconstruction(),t}return null}finishedReconstruction(){this.reconPack=null,this.buffers=[]}}const Vn=Number.isInteger||function(n){return typeof n=="number"&&isFinite(n)&&Math.floor(n)===n};function _t(n){return Object.prototype.toString.call(n)==="[object Object]"}const Kn=Object.freeze(Object.defineProperty({__proto__:null,Decoder:Ye,Encoder:Hn,get PacketType(){return b}},Symbol.toStringTag,{value:"Module"}));function Y(n,e,t){return n.on(e,t),function(){n.off(e,t)}}const Yn=Object.freeze({connect:1,connect_error:1,disconnect:1,disconnecting:1,newListener:1,removeListener:1});class kt extends O{constructor(e,t,i){super(),this.connected=!1,this.recovered=!1,this.receiveBuffer=[],this.sendBuffer=[],this._queue=[],this._queueSeq=0,this.ids=0,this.acks={},this.flags={},this.io=e,this.nsp=t,i&&i.auth&&(this.auth=i.auth),this._opts=Object.assign({},i),this.io._autoConnect&&this.open()}get disconnected(){return!this.connected}subEvents(){if(this.subs)return;const e=this.io;this.subs=[Y(e,"open",this.onopen.bind(this)),Y(e,"packet",this.onpacket.bind(this)),Y(e,"error",this.onerror.bind(this)),Y(e,"close",this.onclose.bind(this))]}get active(){return!!this.subs}connect(){return this.connected?this:(this.subEvents(),this.io._reconnecting||this.io.open(),this.io._readyState==="open"&&this.onopen(),this)}open(){return this.connect()}send(...e){return e.unshift("message"),this.emit.apply(this,e),this}emit(e,...t){var i,s,r;if(Yn.hasOwnProperty(e))throw new Error('"'+e.toString()+'" is a reserved event name');if(t.unshift(e),this._opts.retries&&!this.flags.fromQueue&&!this.flags.volatile)return this._addToQueue(t),this;const o={type:b.EVENT,data:t};if(o.options={},o.options.compress=this.flags.compress!==!1,typeof t[t.length-1]=="function"){const x=this.ids++,I=t.pop();this._registerAckCallback(x,I),o.id=x}const c=(s=(i=this.io.engine)===null||i===void 0?void 0:i.transport)===null||s===void 0?void 0:s.writable,l=this.connected&&!(!((r=this.io.engine)===null||r===void 0)&&r._hasPingExpired());return this.flags.volatile&&!c||(l?(this.notifyOutgoingListeners(o),this.packet(o)):this.sendBuffer.push(o)),this.flags={},this}_registerAckCallback(e,t){var i;const s=(i=this.flags.timeout)!==null&&i!==void 0?i:this._opts.ackTimeout;if(s===void 0){this.acks[e]=t;return}const r=this.io.setTimeoutFn(()=>{delete this.acks[e];for(let c=0;c<this.sendBuffer.length;c++)this.sendBuffer[c].id===e&&this.sendBuffer.splice(c,1);t.call(this,new Error("operation has timed out"))},s),o=(...c)=>{this.io.clearTimeoutFn(r),t.apply(this,c)};o.withError=!0,this.acks[e]=o}emitWithAck(e,...t){return new Promise((i,s)=>{const r=(o,c)=>o?s(o):i(c);r.withError=!0,t.push(r),this.emit(e,...t)})}_addToQueue(e){let t;typeof e[e.length-1]=="function"&&(t=e.pop());const i={id:this._queueSeq++,tryCount:0,pending:!1,args:e,flags:Object.assign({fromQueue:!0},this.flags)};e.push((s,...r)=>(this._queue[0],s!==null?i.tryCount>this._opts.retries&&(this._queue.shift(),t&&t(s)):(this._queue.shift(),t&&t(null,...r)),i.pending=!1,this._drainQueue())),this._queue.push(i),this._drainQueue()}_drainQueue(e=!1){if(!this.connected||this._queue.length===0)return;const t=this._queue[0];t.pending&&!e||(t.pending=!0,t.tryCount++,this.flags=t.flags,this.emit.apply(this,t.args))}packet(e){e.nsp=this.nsp,this.io._packet(e)}onopen(){typeof this.auth=="function"?this.auth(e=>{this._sendConnectPacket(e)}):this._sendConnectPacket(this.auth)}_sendConnectPacket(e){this.packet({type:b.CONNECT,data:this._pid?Object.assign({pid:this._pid,offset:this._lastOffset},e):e})}onerror(e){this.connected||this.emitReserved("connect_error",e)}onclose(e,t){this.connected=!1,delete this.id,this.emitReserved("disconnect",e,t),this._clearAcks()}_clearAcks(){Object.keys(this.acks).forEach(e=>{if(!this.sendBuffer.some(i=>String(i.id)===e)){const i=this.acks[e];delete this.acks[e],i.withError&&i.call(this,new Error("socket has been disconnected"))}})}onpacket(e){if(e.nsp===this.nsp)switch(e.type){case b.CONNECT:e.data&&e.data.sid?this.onconnect(e.data.sid,e.data.pid):this.emitReserved("connect_error",new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));break;case b.EVENT:case b.BINARY_EVENT:this.onevent(e);break;case b.ACK:case b.BINARY_ACK:this.onack(e);break;case b.DISCONNECT:this.ondisconnect();break;case b.CONNECT_ERROR:this.destroy();const i=new Error(e.data.message);i.data=e.data.data,this.emitReserved("connect_error",i);break}}onevent(e){const t=e.data||[];e.id!=null&&t.push(this.ack(e.id)),this.connected?this.emitEvent(t):this.receiveBuffer.push(Object.freeze(t))}emitEvent(e){if(this._anyListeners&&this._anyListeners.length){const t=this._anyListeners.slice();for(const i of t)i.apply(this,e)}super.emit.apply(this,e),this._pid&&e.length&&typeof e[e.length-1]=="string"&&(this._lastOffset=e[e.length-1])}ack(e){const t=this;let i=!1;return function(...s){i||(i=!0,t.packet({type:b.ACK,id:e,data:s}))}}onack(e){const t=this.acks[e.id];typeof t=="function"&&(delete this.acks[e.id],t.withError&&e.data.unshift(null),t.apply(this,e.data))}onconnect(e,t){this.id=e,this.recovered=t&&this._pid===t,this._pid=t,this.connected=!0,this.emitBuffered(),this._drainQueue(!0),this.emitReserved("connect")}emitBuffered(){this.receiveBuffer.forEach(e=>this.emitEvent(e)),this.receiveBuffer=[],this.sendBuffer.forEach(e=>{this.notifyOutgoingListeners(e),this.packet(e)}),this.sendBuffer=[]}ondisconnect(){this.destroy(),this.onclose("io server disconnect")}destroy(){this.subs&&(this.subs.forEach(e=>e()),this.subs=void 0),this.io._destroy(this)}disconnect(){return this.connected&&this.packet({type:b.DISCONNECT}),this.destroy(),this.connected&&this.onclose("io client disconnect"),this}close(){return this.disconnect()}compress(e){return this.flags.compress=e,this}get volatile(){return this.flags.volatile=!0,this}timeout(e){return this.flags.timeout=e,this}onAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.push(e),this}prependAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.unshift(e),this}offAny(e){if(!this._anyListeners)return this;if(e){const t=this._anyListeners;for(let i=0;i<t.length;i++)if(e===t[i])return t.splice(i,1),this}else this._anyListeners=[];return this}listenersAny(){return this._anyListeners||[]}onAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.push(e),this}prependAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.unshift(e),this}offAnyOutgoing(e){if(!this._anyOutgoingListeners)return this;if(e){const t=this._anyOutgoingListeners;for(let i=0;i<t.length;i++)if(e===t[i])return t.splice(i,1),this}else this._anyOutgoingListeners=[];return this}listenersAnyOutgoing(){return this._anyOutgoingListeners||[]}notifyOutgoingListeners(e){if(this._anyOutgoingListeners&&this._anyOutgoingListeners.length){const t=this._anyOutgoingListeners.slice();for(const i of t)i.apply(this,e.data)}}}function ae(n){n=n||{},this.ms=n.min||100,this.max=n.max||1e4,this.factor=n.factor||2,this.jitter=n.jitter>0&&n.jitter<=1?n.jitter:0,this.attempts=0}ae.prototype.duration=function(){var n=this.ms*Math.pow(this.factor,this.attempts++);if(this.jitter){var e=Math.random(),t=Math.floor(e*this.jitter*n);n=(Math.floor(e*10)&1)==0?n-t:n+t}return Math.min(n,this.max)|0},ae.prototype.reset=function(){this.attempts=0},ae.prototype.setMin=function(n){this.ms=n},ae.prototype.setMax=function(n){this.max=n},ae.prototype.setJitter=function(n){this.jitter=n};class We extends O{constructor(e,t){var i;super(),this.nsps={},this.subs=[],e&&typeof e=="object"&&(t=e,e=void 0),t=t||{},t.path=t.path||"/socket.io",this.opts=t,_e(this,t),this.reconnection(t.reconnection!==!1),this.reconnectionAttempts(t.reconnectionAttempts||1/0),this.reconnectionDelay(t.reconnectionDelay||1e3),this.reconnectionDelayMax(t.reconnectionDelayMax||5e3),this.randomizationFactor((i=t.randomizationFactor)!==null&&i!==void 0?i:.5),this.backoff=new ae({min:this.reconnectionDelay(),max:this.reconnectionDelayMax(),jitter:this.randomizationFactor()}),this.timeout(t.timeout==null?2e4:t.timeout),this._readyState="closed",this.uri=e;const s=t.parser||Kn;this.encoder=new s.Encoder,this.decoder=new s.Decoder,this._autoConnect=t.autoConnect!==!1,this._autoConnect&&this.open()}reconnection(e){return arguments.length?(this._reconnection=!!e,e||(this.skipReconnect=!0),this):this._reconnection}reconnectionAttempts(e){return e===void 0?this._reconnectionAttempts:(this._reconnectionAttempts=e,this)}reconnectionDelay(e){var t;return e===void 0?this._reconnectionDelay:(this._reconnectionDelay=e,(t=this.backoff)===null||t===void 0||t.setMin(e),this)}randomizationFactor(e){var t;return e===void 0?this._randomizationFactor:(this._randomizationFactor=e,(t=this.backoff)===null||t===void 0||t.setJitter(e),this)}reconnectionDelayMax(e){var t;return e===void 0?this._reconnectionDelayMax:(this._reconnectionDelayMax=e,(t=this.backoff)===null||t===void 0||t.setMax(e),this)}timeout(e){return arguments.length?(this._timeout=e,this):this._timeout}maybeReconnectOnOpen(){!this._reconnecting&&this._reconnection&&this.backoff.attempts===0&&this.reconnect()}open(e){if(~this._readyState.indexOf("open"))return this;this.engine=new Bn(this.uri,this.opts);const t=this.engine,i=this;this._readyState="opening",this.skipReconnect=!1;const s=Y(t,"open",function(){i.onopen(),e&&e()}),r=c=>{this.cleanup(),this._readyState="closed",this.emitReserved("error",c),e?e(c):this.maybeReconnectOnOpen()},o=Y(t,"error",r);if(this._timeout!==!1){const c=this._timeout,l=this.setTimeoutFn(()=>{s(),r(new Error("timeout")),t.close()},c);this.opts.autoUnref&&l.unref(),this.subs.push(()=>{this.clearTimeoutFn(l)})}return this.subs.push(s),this.subs.push(o),this}connect(e){return this.open(e)}onopen(){this.cleanup(),this._readyState="open",this.emitReserved("open");const e=this.engine;this.subs.push(Y(e,"ping",this.onping.bind(this)),Y(e,"data",this.ondata.bind(this)),Y(e,"error",this.onerror.bind(this)),Y(e,"close",this.onclose.bind(this)),Y(this.decoder,"decoded",this.ondecoded.bind(this)))}onping(){this.emitReserved("ping")}ondata(e){try{this.decoder.add(e)}catch(t){this.onclose("parse error",t)}}ondecoded(e){we(()=>{this.emitReserved("packet",e)},this.setTimeoutFn)}onerror(e){this.emitReserved("error",e)}socket(e,t){let i=this.nsps[e];return i?this._autoConnect&&!i.active&&i.connect():(i=new kt(this,e,t),this.nsps[e]=i),i}_destroy(e){const t=Object.keys(this.nsps);for(const i of t)if(this.nsps[i].active)return;this._close()}_packet(e){const t=this.encoder.encode(e);for(let i=0;i<t.length;i++)this.engine.write(t[i],e.options)}cleanup(){this.subs.forEach(e=>e()),this.subs.length=0,this.decoder.destroy()}_close(){this.skipReconnect=!0,this._reconnecting=!1,this.onclose("forced close")}disconnect(){return this._close()}onclose(e,t){var i;this.cleanup(),(i=this.engine)===null||i===void 0||i.close(),this.backoff.reset(),this._readyState="closed",this.emitReserved("close",e,t),this._reconnection&&!this.skipReconnect&&this.reconnect()}reconnect(){if(this._reconnecting||this.skipReconnect)return this;const e=this;if(this.backoff.attempts>=this._reconnectionAttempts)this.backoff.reset(),this.emitReserved("reconnect_failed"),this._reconnecting=!1;else{const t=this.backoff.duration();this._reconnecting=!0;const i=this.setTimeoutFn(()=>{e.skipReconnect||(this.emitReserved("reconnect_attempt",e.backoff.attempts),!e.skipReconnect&&e.open(s=>{s?(e._reconnecting=!1,e.reconnect(),this.emitReserved("reconnect_error",s)):e.onreconnect()}))},t);this.opts.autoUnref&&i.unref(),this.subs.push(()=>{this.clearTimeoutFn(i)})}}onreconnect(){const e=this.backoff.attempts;this._reconnecting=!1,this.backoff.reset(),this.emitReserved("reconnect",e)}}const he={};function Ee(n,e){typeof n=="object"&&(e=n,n=void 0),e=e||{};const t=Nn(n,e.path||"/socket.io"),i=t.source,s=t.id,r=t.path,o=he[s]&&r in he[s].nsps,c=e.forceNew||e["force new connection"]||e.multiplex===!1||o;let l;return c?l=new We(i,e):(he[s]||(he[s]=new We(i,e)),l=he[s]),t.query&&!e.query&&(e.query=t.queryKey),l.socket(t.path,e)}Object.assign(Ee,{Manager:We,Socket:kt,io:Ee,connect:Ee});function Wn(n,e,t){const i=n.apiBase||window.location.origin,s=Ee(i,{path:"/livechat-ws",auth:{siteKey:n.siteKey,visitorId:n.visitorId,sessionId:e},transports:["websocket","polling"],reconnection:!0,reconnectionDelay:600,reconnectionDelayMax:8e3});return s.on("livechat:event",r=>{r.sessionId===e&&t(r)}),s}const Jn=`
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
`,Je=[{name:"Smileys",emojis:["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","🙄","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤐","🤨","😐","😑","😶","😏","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷"]},{name:"Hearts",emojis:["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟"]},{name:"Hands",emojis:["👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👋","🤚","🖐️","✋","🖖","👏","🙌","🤝","🙏","✍️","💪","🦾"]},{name:"Objects",emojis:["🔥","✨","🎉","🎊","🎁","🏆","🥇","⭐","🌟","💫","💥","💯","✅","❌","⚠️","❓","❗","💡","📌","📎","🔗","🔒","🔑","⏰","⏳","📅","📆","🗓️","📊","📈"]},{name:"Travel",emojis:["🚀","✈️","🚗","🚕","🚙","🚌","🏠","🏢","🏥","🏦","🏪","🏫","⛺","🌍","🌎","🌏","🗺️","🏖️","🏔️","🌋"]}],Xn=[[":)","🙂"],[":-)","🙂"],[":D","😄"],[":-D","😄"],["xD","😆"],["XD","😆"],[":P","😛"],[":p","😋"],[":-P","😛"],[":'(","😢"],[":(","🙁"],[":-(","🙁"],[";)","😉"],[";-)","😉"],[":O","😮"],[":o","😮"],[":-O","😮"],[":oO","😳"],[":|","😐"],[":-|","😐"],[":/","😕"],[":-/","😕"],["<3","❤️"],["</3","💔"],[":*","😘"],["B)","😎"]];function Gn(n){let e=n;for(const[t,i]of Xn){const s=t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),r=new RegExp(`(^|\\s)${s}(?=\\s|$|[.,!?])`,"g");e=e.replace(r,`$1${i}`)}return e}const Qn="https://gist.githubusercontent.com/Sharifur/b40c7b54b97d43f353f1382e51c70535/raw/f6446fa378bf266cacf604f1e97f8f318e01e157/temporary-email-address-domain-list.json",St="livechat_disposable_domains",Et="livechat_disposable_domains_ts",Zn=1440*60*1e3;let ne=null;async function Tt(){if(ne)return ne;try{const n=localStorage.getItem(Et),e=localStorage.getItem(St),t=n?Number(n):0;if(e&&t&&Date.now()-t<Zn){const i=JSON.parse(e);return ne=new Set(i.map(s=>s.toLowerCase())),ne}}catch(n){}try{const n=new AbortController,e=setTimeout(()=>n.abort(),4e3),t=await fetch(Qn,{signal:n.signal});if(clearTimeout(e),t.ok){const i=await t.json(),r=(Array.isArray(i)?i:[]).map(o=>String(o).trim().toLowerCase()).filter(Boolean);ne=new Set(r);try{localStorage.setItem(St,JSON.stringify(r)),localStorage.setItem(Et,String(Date.now()))}catch(o){}return ne}}catch(n){}return ne=new Set(["mailinator.com","guerrillamail.com","10minutemail.com","tempmail.com","temp-mail.org","yopmail.com","trashmail.com","fakeinbox.com","throwawaymail.com","getairmail.com","sharklasers.com"]),ne}async function ei(n){const e=n.lastIndexOf("@");if(e<0)return!1;const t=n.slice(e+1).trim().toLowerCase();return t?(await Tt()).has(t):!1}function ti(){Tt()}const ni={siteKey:"",botName:"Hi there",botSubtitle:"We typically reply in a few seconds.",welcomeMessage:null,brandColor:"#2563eb",position:"bottom-right"},Te="livechat_messages_cache_v2",It="livechat_cache_bust",Xe="livechat_session_id",Ie="livechat_identify_dismissed",Ae="livechat_identify_name",pe="livechat_identify_email",At="livechat_send_log",Le="livechat_proactive_seen",ii=30,si=6e4,ri=3;function oi(n,e=ni){var me,ge;gi(n.siteKey,e.cacheBust);const t=Date.now(),i=document.createElement("div");i.id="livechat-widget-root";const s=()=>window.innerWidth<=480,r="10px",o="10px",c="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;",l=`position: fixed; bottom: ${r}; right: ${o}; z-index: 2147483646;`;i.style.cssText=s()?l:c,document.body.appendChild(i);const y=i.attachShadow({mode:"open"}),x=(me=bi(e.brandColor))!=null?me:"#2563eb",I=$t(x,.35),g=$t(x,.45);i.style.setProperty("--lc-brand",x),i.style.setProperty("--lc-brand-shadow",I),i.style.setProperty("--lc-brand-shadow-hover",g),e.position==="bottom-left"&&i.classList.add("lc-position-left");const R=document.createElement("style");R.textContent=Jn,y.appendChild(R);const P=()=>{i.style.setProperty("--lc-brand",x),i.style.setProperty("--lc-brand-shadow",I),i.style.setProperty("--lc-brand-shadow-hover",g)},h={open:!1,sessionId:fi(),messages:yi(),socket:null,panel:null,askedForEmail:!1,askedForName:!1,knownName:hi(),unread:0,sessionClosed:!1,feedbackAsked:!1,operators:(ge=e.operators)!=null?ge:[],host:i,cfg:n,reapplyCssVars:P,activeDraftId:null,historyPushed:!1,pendingTrigger:void 0,closePanelAnim:void 0,collectPageContext:void 0},M=document.createElement("button");M.className="lc-bubble",M.innerHTML=Ti(),y.appendChild(M);const k=document.createElement("span");k.className="lc-unread",k.style.display="none",M.appendChild(k);const p=document.createElement("div");if(p.className="lc-proactive",p.style.display="none",e.welcomeMessage){p.innerHTML=`
      <button class="lc-proactive-close" aria-label="Dismiss">&#x2715;</button>
      <div class="lc-proactive-text">${C(e.welcomeMessage)}</div>
    `,y.appendChild(p);let _=!1;try{_=!!sessionStorage.getItem(Le)}catch(H){}_||setTimeout(()=>{h.open||(p.style.display="block")},1500),p.querySelector(".lc-proactive-close").addEventListener("click",H=>{H.stopPropagation(),p.style.display="none";try{sessionStorage.setItem(Le,"1")}catch(j){}}),p.querySelector(".lc-proactive-text").addEventListener("click",()=>{p.style.display="none";try{sessionStorage.setItem(Le,"1")}catch(H){}M.click()})}h.messages.length===0&&e.welcomeMessage&&(h.messages.push({id:"welcome",role:"agent",content:e.welcomeMessage,createdAt:new Date().toISOString()}),re(h.messages));const A=ai(y,n,h,ie,e);A.style.display="none",h.panel=A,A._state=h,A._cfg=n;function u(){const _=window.visualViewport;_?i.style.cssText=`position: fixed; top: ${_.offsetTop}px; left: ${_.offsetLeft}px; width: ${_.width}px; height: ${_.height}px; z-index: 2147483646;`:i.style.cssText="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483646;",P()}let S=null;function D(){S!==null&&cancelAnimationFrame(S),S=requestAnimationFrame(()=>{S=null,h.open&&(s()?u():(i.style.cssText=c,P()))})}let B=!1;function G(){B||!window.visualViewport||(B=!0,window.visualViewport.addEventListener("resize",D),window.visualViewport.addEventListener("scroll",D),window.addEventListener("orientationchange",()=>{setTimeout(D,150)}))}window.addEventListener("popstate",()=>{h.open&&h.historyPushed&&(h.historyPushed=!1,ce())});function tt(){var H,j,L,Re;const _={};try{const E=document.body.scrollHeight-window.innerHeight;_.scrollDepth=E>0?Math.round(window.scrollY/E*100):100}catch(E){}_.timeOnPageSec=Math.round((Date.now()-t)/1e3);try{const E=(j=(H=document.querySelector("h1"))==null?void 0:H.textContent)==null?void 0:j.trim().slice(0,100);E&&(_.pageH1=E)}catch(E){}try{const E=(Re=(L=document.querySelector('meta[name="description"]'))==null?void 0:L.content)==null?void 0:Re.trim().slice(0,200);E&&(_.metaDescription=E)}catch(E){}try{const E=new URLSearchParams(window.location.search);E.get("utm_source")&&(_.utmSource=E.get("utm_source").slice(0,80)),E.get("utm_campaign")&&(_.utmCampaign=E.get("utm_campaign").slice(0,80)),E.get("utm_medium")&&(_.utmMedium=E.get("utm_medium").slice(0,80)),E.get("utm_term")&&(_.utmTerm=E.get("utm_term").slice(0,80))}catch(E){}try{document.referrer&&(_.referrerDomain=new URL(document.referrer).hostname.slice(0,100))}catch(E){}try{_.isReturnVisitor=!!localStorage.getItem("livechat_session_id")}catch(E){}return h.pendingTrigger&&(_.triggeredBy=h.pendingTrigger.slice(0,100),h.pendingTrigger=void 0),n.context&&Object.keys(n.context).length&&(_.custom=n.context),_}h.collectPageContext=tt,document.addEventListener("click",_=>{var j;const H=_.target.closest("[data-lc-open]");H&&(_.preventDefault(),h.pendingTrigger=(j=H.getAttribute("data-lc-open"))!=null?j:void 0,h.open||(h.open=!0,Ce()))});function Ce(){var _;if(s()){u(),G();try{history.pushState({lcPanel:!0},""),h.historyPushed=!0}catch(H){}}if(A.classList.remove("lc-panel--closing"),A.style.display="flex",h.unread=0,k.style.display="none",Ot(A),Ge(h),e.requireEmail){let H=!1;try{const j=localStorage.getItem(pe);H=j==="saved"||!!j&&j!=="skipped"}catch(j){}if(!H){ci(A,n);return}}(_=A.querySelector("textarea"))==null||_.focus()}function ce(){h.open=!1,A.classList.add("lc-panel--closing"),setTimeout(()=>{h.open||(A.style.display="none",s()&&(i.style.cssText=l,P())),A.classList.remove("lc-panel--closing")},180)}h.closePanelAnim=ce,M.addEventListener("click",()=>{p.style.display="none";try{sessionStorage.setItem(Le,"1")}catch(_){}if(h.open=!h.open,h.open)Ce();else{if(h.historyPushed){h.historyPushed=!1;try{history.back()}catch(_){}}ce()}}),h.sessionId&&Lt(n,h,ie,e),ti();function ie(){li(A,h),!h.open&&h.unread>0?(k.textContent=String(Math.min(h.unread,99)),k.style.display="flex"):k.style.display="none"}ie()}function ai(n,e,t,i,s){var Kt,Yt,Wt,Jt;const r=document.createElement("div");r.className="lc-panel";const c=((Kt=s.operators)!=null?Kt:[]).length>1?((Yt=s.botName)==null?void 0:Yt.trim())||s.operatorName||"Chat with us":((Wt=s.operatorName)==null?void 0:Wt.trim())||s.botName;r.innerHTML=`
    <div class="lc-header">
      <div class="lc-header-top">
        <div class="lc-header-inner">
          ${$i((Jt=s.operators)!=null?Jt:[],s.operatorName)}
          <div class="lc-header-text">
            <div class="lc-header-title">${C(c)}</div>
          </div>
        </div>
        <div class="lc-header-actions">
          <button class="lc-newchat-btn" aria-label="Start new conversation">${Ri()}</button>
          <button class="lc-menu-btn" aria-label="Conversation menu" aria-haspopup="true">${Ai()}</button>
          <div class="lc-menu" role="menu" style="display:none;">
            <button class="lc-menu-item" data-action="new">${Li()} Start a new conversation</button>
            <button class="lc-menu-item" data-action="close">${Oi()} End this chat</button>
          </div>
          <button class="lc-close" aria-label="Close">${Bt()}</button>
        </div>
      </div>
      <div class="lc-header-sub-row">
        <span class="lc-online-dot"></span>${C(s.botSubtitle)}
      </div>
    </div>
    <div class="lc-messages-wrap">
      <div class="lc-messages"></div>
      <button class="lc-scroll-btn" type="button" style="display:none;" aria-label="Scroll to latest">${Bt()} New messages</button>
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
      <button type="button" class="lc-attach-btn" aria-label="Attach file">${Si()}</button>
      <button type="button" class="lc-emoji-btn" aria-label="Insert emoji">${Ci()}</button>
      <div class="lc-emoji-pop" style="display:none;" role="dialog" aria-label="Emoji picker">
        <div class="lc-emoji-tabs">${Je.map((a,d)=>`<button type="button" class="lc-emoji-tab${d===0?" lc-emoji-tab-active":""}" data-cat="${d}">${a.name}</button>`).join("")}</div>
        <div class="lc-emoji-grid">${Je[0].emojis.map(a=>`<button type="button" class="lc-emoji-pick" data-emoji="${a}">${a}</button>`).join("")}</div>
      </div>
      <textarea placeholder="Type your message…" rows="1"></textarea>
      <button type="submit" aria-label="Send">${Nt()}</button>
    </form>
  `,n.appendChild(r);const y=t.host.classList.contains("lc-position-left")?"position: fixed; bottom: 10px; left: 10px; z-index: 2147483646;":"position: fixed; bottom: 10px; right: 10px; z-index: 2147483646;";r.querySelector(".lc-newchat-btn").addEventListener("click",()=>{confirm("Start a new conversation? The current chat will be cleared.")&&j()}),r.querySelector(".lc-close").addEventListener("click",()=>{if(t.historyPushed){t.historyPushed=!1;try{history.back()}catch(a){}}if(t.closePanelAnim){t.closePanelAnim();return}t.open=!1,r.classList.add("lc-panel--closing"),setTimeout(()=>{var a;r.style.display="none",window.innerWidth<=480&&(t.host.style.cssText=y,(a=t.reapplyCssVars)==null||a.call(t)),r.classList.remove("lc-panel--closing")},180)});const g=r.querySelector(".lc-menu-btn"),R=r.querySelector(".lc-menu"),P=()=>{R.style.display="none"};g.addEventListener("click",a=>{a.stopPropagation(),R.style.display=R.style.display==="none"?"block":"none"}),r.addEventListener("click",a=>{!R.contains(a.target)&&a.target!==g&&P()}),R.addEventListener("click",async a=>{const d=a.target.closest(".lc-menu-item");if(!d)return;P();const f=d.getAttribute("data-action");if(f==="new"){if(!confirm("Start a new conversation? The current chat will be cleared."))return;j()}else if(f==="close"){if(!confirm("End this chat? You can always start a new one."))return;const v=t.sessionId;if(v)try{await fetch(`${e.apiBase}/livechat/session/${encodeURIComponent(v)}/close`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:e.siteKey,visitorId:e.visitorId}),credentials:"omit"})}catch(m){}j(),t.messages=[{id:`system-${Date.now()}`,role:"system",content:"Chat ended. Type a message to start a new conversation.",createdAt:new Date().toISOString()}],re(t.messages),i()}});const h=r.querySelector(".lc-messages"),M=r.querySelector(".lc-scroll-btn");h.addEventListener("scroll",()=>{const a=h.scrollHeight-h.scrollTop-h.clientHeight;M.style.display=a>120?"flex":"none"}),M.addEventListener("click",()=>{h.scrollTop=h.scrollHeight,M.style.display="none"});const k=r.querySelector(".lc-composer"),p=r.querySelector("textarea"),A=r.querySelector(".lc-hp"),u=r.querySelector('.lc-composer button[type="submit"]'),S=r.querySelector(".lc-attach-btn"),D=r.querySelector(".lc-file-input"),B=r.querySelector(".lc-pending"),G=r.querySelector(".lc-quick-replies"),tt=r.querySelector(".lc-session-end"),Ce=r.querySelector(".lc-session-end-btn"),ce=r.querySelector(".lc-emoji-btn"),ie=r.querySelector(".lc-emoji-pop"),me=r.querySelector(".lc-emoji-tabs"),ge=r.querySelector(".lc-emoji-grid");function _(a){var m,T;const d=(m=p.selectionStart)!=null?m:p.value.length,f=(T=p.selectionEnd)!=null?T:d;p.value=p.value.slice(0,d)+a+p.value.slice(f);const v=d+a.length;p.setSelectionRange(v,v),p.focus()}function H(a){const d=Je[a];d&&(ge.innerHTML=d.emojis.map(f=>`<button type="button" class="lc-emoji-pick" data-emoji="${f}">${f}</button>`).join(""))}ce.addEventListener("click",a=>{a.stopPropagation(),ie.style.display=ie.style.display==="none"?"block":"none"}),r.addEventListener("click",a=>{a.target instanceof Node&&!ie.contains(a.target)&&a.target!==ce&&(ie.style.display="none")}),me.addEventListener("click",a=>{var f;const d=a.target.closest(".lc-emoji-tab");d&&(me.querySelectorAll(".lc-emoji-tab").forEach(v=>v.classList.remove("lc-emoji-tab-active")),d.classList.add("lc-emoji-tab-active"),H(Number((f=d.getAttribute("data-cat"))!=null?f:0)))}),ge.addEventListener("click",a=>{var f;const d=a.target.closest(".lc-emoji-pick");d&&_((f=d.getAttribute("data-emoji"))!=null?f:"")}),p.addEventListener("input",()=>{var f;const a=p.value,d=Gn(a);if(d!==a){const v=d.length-a.length,m=((f=p.selectionStart)!=null?f:a.length)+v;p.value=d,p.setSelectionRange(m,m)}});function j(){var a;(a=t.socket)==null||a.disconnect(),t.socket=null,t.sessionId=null,t.sessionClosed=!1,t.messages=[],t.askedForEmail=!1,t.unread=0;try{localStorage.removeItem(Xe)}catch(d){}try{localStorage.removeItem(Te)}catch(d){}try{localStorage.removeItem(Ie)}catch(d){}tt.style.display="none",p.disabled=!1,u.disabled=!1,S.disabled=!1,s!=null&&s.welcomeMessage&&(t.messages.push({id:"welcome",role:"agent",content:s.welcomeMessage,createdAt:new Date().toISOString()}),re(t.messages)),i()}Ce.addEventListener("click",j);const L=[],Re=Date.now();let E=!1;p.addEventListener("keydown",()=>{E=!0}),p.addEventListener("input",()=>{E=!0});function Ut(a){p.value=a,E=!0,k.requestSubmit()}r._submitFromChip=Ut;const Ht=()=>{var v;const a=t.messages.some(m=>m.role==="visitor"),d=/\b(talk|speak|connect|chat)\b.*\b(human|agent|person|representative|support team)\b|\b(human|live agent|real person)\b/i,f=((v=s.welcomeQuickReplies)!=null?v:[]).filter(Boolean).filter(m=>!d.test(m));if(a||f.length===0){G.style.display="none",G.innerHTML="";return}G.style.display="flex",G.innerHTML=f.map((m,T)=>`<button data-i="${T}" type="button">${C(m)}</button>`).join(""),G.querySelectorAll("button").forEach(m=>{m.addEventListener("click",()=>{const T=Number(m.dataset.i),$=f[T];$&&Ut($)})})};S.addEventListener("click",()=>D.click()),D.addEventListener("change",async()=>{var v;const a=(v=D.files)==null?void 0:v[0];if(D.value="",!a)return;if(a.size>10*1024*1024){W(r,`File too large: ${a.name} (max 10 MB)`);return}if(L.length>=5){W(r,"You can attach up to 5 files per message.");return}if(!t.sessionId){W(r,"Send a message first, then attach files.");return}const d=a.type.startsWith("image/")?URL.createObjectURL(a):void 0,f={id:"pending-"+Date.now(),mimeType:a.type,sizeBytes:a.size,originalFilename:a.name,url:"",localUrl:d};L.push(f),se();try{const m=await q(e,t.sessionId,a),T=L.indexOf(f);T>=0&&(L[T]=le(ee({},m),{localUrl:d})),se()}catch(m){const T=L.indexOf(f);T>=0&&L.splice(T,1),d&&URL.revokeObjectURL(d),W(r,`Upload failed: ${m.message}`),se()}});function se(){if(!L.length){B.style.display="none",B.innerHTML="";return}B.style.display="flex",B.innerHTML=L.map((a,d)=>{var w;const f=a.id.startsWith("pending-"),v=(w=a.localUrl)!=null?w:"",T=a.mimeType.startsWith("image/")&&v?`<img class="lc-chip-thumb" src="${C(v)}" alt="">`:"",$=f?`${T}<span class="lc-chip-label lc-chip-uploading">Uploading…</span><span class="lc-spinner"></span>`:`${T}<span class="lc-chip-label">${C(a.originalFilename)}</span><button data-i="${d}" aria-label="Remove">×</button>`;return`<span class="lc-chip${f?" lc-chip--busy":""}">${$}</span>`}).join(""),B.querySelectorAll("button[data-i]").forEach(a=>{a.addEventListener("click",()=>{const d=Number(a.dataset.i),f=L.splice(d,1)[0];f!=null&&f.localUrl&&URL.revokeObjectURL(f.localUrl),se()})})}let nt=null,Ft=!1;const ye=a=>{var d;Ft!==a&&(Ft=a,(d=t.socket)==null||d.emit("livechat:typing",{on:a}))};p.addEventListener("input",()=>{p.style.height="auto",p.style.height=Math.min(120,p.scrollHeight)+"px",p.value.trim()?(ye(!0),nt&&clearTimeout(nt),nt=setTimeout(()=>ye(!1),1500)):ye(!1)}),p.addEventListener("blur",()=>ye(!1)),p.addEventListener("keydown",a=>{a.key==="Enter"&&!a.shiftKey&&(a.preventDefault(),k.requestSubmit())}),p.addEventListener("paste",async a=>{var v;const d=(v=a.clipboardData)==null?void 0:v.items;if(!d)return;const f=[];for(const m of d)if(m.kind==="file"&&m.type.startsWith("image/")){const T=m.getAsFile();T&&f.push(T)}if(f.length){if(a.preventDefault(),!t.sessionId){W(r,"Send a message first, then paste images.");return}for(const m of f){if(m.size>10*1024*1024){W(r,`Pasted image too large: ${m.name||"image"} (max 10 MB)`);continue}if(L.length>=5)break;const T=m.name?m:new File([m],`pasted-${Date.now()}.png`,{type:m.type}),$=URL.createObjectURL(T),w={id:"pending-"+Math.random().toString(36).slice(2),mimeType:m.type,sizeBytes:m.size,originalFilename:T.name,url:"",localUrl:$};L.push(w),se();try{const z=await q(e,t.sessionId,T),N=L.indexOf(w);N>=0&&(L[N]=le(ee({},z),{localUrl:$})),se()}catch(z){const N=L.indexOf(w);N>=0&&L.splice(N,1),URL.revokeObjectURL($),W(r,`Upload failed: ${z.message}`),se()}}}}),k.addEventListener("submit",async a=>{var m,T,$;if(a.preventDefault(),A.value)return;if(t.sessionClosed){W(r,"This conversation has ended. Start a new chat below.");return}const d=p.value.trim(),f=L.some(w=>w.id.startsWith("pending-")),v=L.filter(w=>w.url&&!w.id.startsWith("pending-"));if(f){W(r,"Your image is still uploading — please wait a moment.");return}if(!(!d&&!v.length)){if(!ui()){W(r,"Slow down — too many messages in the last minute.");return}u.disabled=!0,p.value="",p.style.height="auto",ye(!1),pi(t,d,v),L.length=0,se(),Ht(),i(),Ct(r);try{const w=await rt(e,d,v.map(z=>z.id),{hp:A.value||void 0,elapsedMs:Date.now()-Re,hadInteraction:E},(T=(m=t.collectPageContext)==null?void 0:m.call(t))!=null?T:{});if(ue(r),t.sessionId=w.sessionId,mi(w.sessionId),"content"in w.agent&&w.agent.content){const z=($=w.agent.id)!=null?$:"";if(!t.socket)Qe(t,w.agent.content,z);else{const N=w.agent.content;setTimeout(()=>{t.messages.some(Q=>Q.id===z)||!!t.activeDraftId||(Qe(t,N,z),i())},250)}}t.socket||Lt(e,t,i,s),di(r,t,i)}catch(w){ue(r),W(r,"Could not send — please try again.")}u.disabled=!1,i()}});const Vt=r.querySelector(".lc-messages");return Vt.addEventListener("click",async a=>{var m,T;const d=a.target,f=d.closest(".lc-inline-skip");if(f){const $=f.getAttribute("data-step");if($==="name")try{localStorage.setItem(Ae,"skipped")}catch(w){}else if($==="email")try{localStorage.setItem(pe,"skipped")}catch(w){}t.messages=t.messages.filter(w=>w.id!==`identify-${$}`),i();return}const v=d.closest(".lc-inline-save");if(v){const $=v.getAttribute("data-step"),w=v.closest(".lc-inline-identify"),z=w==null?void 0:w.querySelector("input"),N=(T=(m=z==null?void 0:z.value)==null?void 0:m.trim())!=null?T:"";if($==="name"){if(!N)return;try{await Be(e,{name:N}),t.knownName=N;try{localStorage.setItem(Ae,N)}catch(Q){}const oe=t.messages.findIndex(Q=>Q.id==="identify-name");oe>=0&&(t.messages[oe]={id:"identify-name-done",role:"system",content:`Nice to meet you, ${N}!`,createdAt:new Date().toISOString()}),i()}catch(oe){}}else if($==="email"){const oe=Q=>{var Xt;z==null||z.classList.add("lc-inline-input--invalid");let Z=w==null?void 0:w.querySelector(".lc-inline-error");!Z&&w&&(Z=document.createElement("div"),Z.className="lc-inline-error",(Xt=w.querySelector(".lc-inline-row"))==null||Xt.after(Z)),Z&&(Z.textContent=Q)};if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(N)){oe("That doesn't look right — double-check?");return}if(await ei(N)){oe("Please use a permanent email — we can’t follow up on temporary inboxes.");return}try{await Be(e,{email:N});try{localStorage.setItem(pe,"saved")}catch(Z){}try{localStorage.setItem(Ie,"saved")}catch(Z){}const Q=t.messages.findIndex(Z=>Z.id==="identify-email");Q>=0&&(t.messages[Q]={id:"identify-email-done",role:"system",content:`Great — we'll reach out at ${N} if we miss you here.`,createdAt:new Date().toISOString()}),i()}catch(Q){}}}}),Vt.addEventListener("keydown",a=>{const d=a;if(d.key!=="Enter")return;const f=d.target;if(!f.matches(".lc-inline-identify input"))return;d.preventDefault();const v=f.closest(".lc-inline-identify"),m=v==null?void 0:v.querySelector(".lc-inline-save");m==null||m.click()}),Ht(),r}function Ge(n){if(!n.open||!n.socket)return;n._seenIds||(n._seenIds=new Set);const e=n.messages.filter(t=>(t.role==="agent"||t.role==="operator")&&!n._seenIds.has(t.id)).map(t=>t.id);e.length&&(e.forEach(t=>n._seenIds.add(t)),n.socket.emit("livechat:messages_seen",{messageIds:e}))}function Lt(n,e,t,i){!e.sessionId||e.socket||(e.socket=Wn(n,e.sessionId,s=>{var l,y,x,I,g,R,P,h,M,k,p,A;if(s.type==="typing"){const u=e.panel;if(!u)return;s.on?Ct(u):ue(u);return}if(s.type==="session_status"&&s.status==="closed"){(l=e.socket)==null||l.disconnect(),e.socket=null,e.sessionClosed=!0;const u=e.panel;if(u){const S=u.querySelector(".lc-session-end"),D=u.querySelector("textarea"),B=u.querySelector('.lc-composer button[type="submit"]'),G=u.querySelector(".lc-attach-btn");S&&(S.style.display="flex"),D&&(D.disabled=!0),B&&(B.disabled=!0),G&&(G.disabled=!0),e.feedbackAsked||(e.feedbackAsked=!0,e.messages.push({id:`feedback-${Date.now()}`,role:"system",content:"__feedback__",createdAt:new Date().toISOString()}))}t();return}if(s.type==="agent_stream_start"&&s.draftId){const u=e.panel;u&&ue(u),e.messages.some(S=>S.id===s.draftId)||(e.activeDraftId=s.draftId,e.messages.push({id:s.draftId,role:"agent",content:"",createdAt:(y=s.createdAt)!=null?y:new Date().toISOString()}),t());return}if(s.type==="agent_stream_delta"&&s.draftId&&s.delta){const u=e.messages.findIndex(S=>S.id===s.draftId);if(u>=0){e.messages[u]=le(ee({},e.messages[u]),{content:e.messages[u].content+s.delta});const S=e.panel,D=S==null?void 0:S.querySelector(".lc-msg--streaming");if(D){D.textContent=e.messages[u].content;const B=S==null?void 0:S.querySelector(".lc-messages");B&&(B.scrollTop=B.scrollHeight)}else t()}return}if(s.type==="agent_stream_end"&&s.draftId&&s.messageId){e.activeDraftId=null;const u=e.messages.findIndex(S=>S.id===s.draftId);if(e.messages.some(S=>S.id===s.messageId)){u>=0&&(e.messages.splice(u,1),re(e.messages),t());return}u>=0&&(e.messages[u]=le(ee({},e.messages[u]),{id:s.messageId,content:(x=s.content)!=null?x:e.messages[u].content}),re(e.messages),e.open?Ge(e):(e.unread=((I=e.unread)!=null?I:0)+1,Rt()),t());return}if(s.type==="agent_suggestions"&&s.messageId&&((g=s.suggestions)!=null&&g.length)){const u=e.messages.findIndex(S=>S.id===s.messageId);u>=0&&(e.messages[u]=le(ee({},e.messages[u]),{suggestions:s.suggestions.slice(0,3)}),t());return}if(s.type!=="message"||!s.messageId||s.role==="visitor"||e.messages.some(u=>u.id===s.messageId))return;if(e.activeDraftId){const u=e.messages.findIndex(S=>S.id===e.activeDraftId);u>=0&&e.messages.splice(u,1),e.activeDraftId=null}const r=(R=s.operatorName)!=null?R:void 0,o=(k=s.operatorAvatarUrl)!=null?k:r&&(M=(h=(P=i==null?void 0:i.operators)==null?void 0:P.find(u=>u.name===r))==null?void 0:h.avatarUrl)!=null?M:void 0;Qe(e,(p=s.content)!=null?p:"",s.messageId,s.role==="operator",s.attachments,r,o);const c=e.panel;c&&ue(c),e.open?Ge(e):(e.unread=((A=e.unread)!=null?A:0)+1,Rt()),t()}))}function ci(n,e,t,i,s){const r=n.querySelector(".lc-email-gate");if(r){r.style.display="flex";return}const o=document.createElement("div");o.className="lc-email-gate",o.style.cssText="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;background:var(--lc-bg,#0f172a);z-index:10;",o.innerHTML=`
    <div style="font-size:14px;font-weight:600;text-align:center;">Enter your email to start chatting</div>
    <div style="font-size:12px;color:#94a3b8;text-align:center;">We'll use this to follow up if we miss you.</div>
    <input class="lc-gate-email" type="email" placeholder="you@example.com" autocomplete="email"
      style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#f1f5f9;font-size:13px;outline:none;box-sizing:border-box;" />
    <div class="lc-gate-error" style="color:#f87171;font-size:11px;display:none;"></div>
    <button class="lc-gate-submit" style="width:100%;padding:10px;border-radius:8px;background:var(--lc-brand,#2563eb);color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer;">Continue</button>
  `,n.appendChild(o);const c=o.querySelector(".lc-gate-email"),l=o.querySelector(".lc-gate-error"),y=o.querySelector(".lc-gate-submit"),x=g=>{l.textContent=g,l.style.display="block"},I=async()=>{var R;const g=c.value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g)){x("That doesn't look like a valid email.");return}l.style.display="none",y.disabled=!0;try{await Promise.resolve().then(()=>Zt).then(P=>P.identify(e,{email:g}));try{localStorage.setItem(pe,"saved"),localStorage.setItem(Ie,"saved")}catch(P){}o.style.display="none",(R=n.querySelector("textarea"))==null||R.focus()}catch(P){x("Something went wrong — please try again."),y.disabled=!1}};y.addEventListener("click",I),c.addEventListener("keydown",g=>{g.key==="Enter"&&(g.preventDefault(),I())}),setTimeout(()=>c.focus(),50)}function li(n,e){const t=n.querySelector(".lc-messages");if(!t)return;if(e.messages.length===0){t.innerHTML='<div class="lc-empty">Send us a message — we will get right back to you.</div>';return}const i=(()=>{for(let s=e.messages.length-1;s>=0;s--){const r=e.messages[s];if(r.role==="agent"||r.role==="operator")return s;if(r.role==="visitor")return-1}return-1})();t.innerHTML=e.messages.map((s,r)=>{var h,M;if(s.content==="__identify_name__"||s.content==="__identify_email__"){const k=s.content==="__identify_name__",p=k?"name":"email",A=!k&&e.knownName?`<span class="lc-inline-greet">Thanks ${C(e.knownName)}! </span>`:"",u=k?"Mind if I get your name?":`${A}If we miss you here, what's the best email to follow up on?`,S=k?"Your name":"you@example.com",D=k?"text":"email",B=k?"given-name":"email";return`<div class="lc-msg-row lc-msg-row-agent">
          <div class="lc-msg-avatar lc-msg-avatar-ai">${qt()}</div>
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-agent lc-inline-identify" data-step="${p}">
              <div class="lc-inline-prompt">${u}</div>
              <div class="lc-inline-row">
                <input type="${D}" class="lc-inline-input" placeholder="${S}" autocomplete="${B}" />
                <button type="button" class="lc-inline-save" data-step="${p}" aria-label="Save">${Nt()}</button>
              </div>
              <button type="button" class="lc-inline-skip" data-step="${p}">${k?"Skip":"Maybe later"}</button>
            </div>
          </div>
        </div>`}const o=s.content?s.role==="visitor"?vi(s.content):wi(s.content):"",c=((h=s.attachments)!=null?h:[]).map(xi).join(""),l=c?`<div class="lc-attachments">${c}</div>`:"",y=ki(s.createdAt),x=y?`<div class="lc-msg-time">${y}</div>`:"",I=r===i&&s.suggestions&&s.suggestions.length?`<div class="lc-chips">${s.suggestions.map(k=>`<button class="lc-chip" data-chip="${K(k)}">${C(k)}</button>`).join("")}</div>`:"";if(s.role==="system")return s.content==="__feedback__"?`<div class="lc-msg lc-msg-system lc-feedback" data-feedback-id="${K(s.id)}">
            <span>How was this chat?</span>
            <button class="lc-fb-btn" data-rating="up" aria-label="Good">👍</button>
            <button class="lc-fb-btn" data-rating="down" aria-label="Bad">👎</button>
          </div>`:`<div class="lc-msg lc-msg-system">${o}</div>`;if(s.role==="visitor")return`<div class="lc-msg-row lc-msg-row-visitor">
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-visitor">${o}${l}</div>
            ${x}
          </div>
        </div>`;const g=s.id&&s.id!=="welcome"?`<div class="lc-msg-rating" data-msg-id="${K(s.id)}">
            <button class="lc-rate-btn" data-rating="up" aria-label="Helpful">&#128077;</button>
            <button class="lc-rate-btn" data-rating="down" aria-label="Not helpful">&#128078;</button>
           </div>`:"";if(s.role==="operator"){const k=(M=s.operatorName)!=null?M:"Operator";return`<div class="lc-msg-row lc-msg-row-agent">
          ${s.operatorAvatarUrl?`<img class="lc-msg-avatar lc-msg-avatar-img" src="${K(s.operatorAvatarUrl)}" alt="${C(k)}" title="${C(k)}">`:`<div class="lc-msg-avatar lc-msg-avatar-op" title="${C(k)}">${C(Ze(k))}</div>`}
          <div class="lc-msg-body">
            <div class="lc-msg-sender">${C(k)}</div>
            <div class="lc-msg lc-msg-agent">${o}${l}</div>
            ${x}
            ${I}
          </div>
        </div>`}const R=s.id===e.activeDraftId,P=R?" lc-msg--streaming":"";return`<div class="lc-msg-row lc-msg-row-agent">
        <div class="lc-msg-avatar lc-msg-avatar-ai">${qt()}</div>
        <div class="lc-msg-body">
          <div class="lc-msg lc-msg-agent${P}">${R?C(s.content):o}${l}</div>
          ${x}
          ${I}
          ${g}
        </div>
      </div>`}).join(""),t.querySelectorAll(".lc-msg-rating").forEach(s=>{s.querySelectorAll(".lc-rate-btn").forEach(r=>{r.addEventListener("click",async()=>{var x,I,g;const o=r.getAttribute("data-rating"),c=(x=s.getAttribute("data-msg-id"))!=null?x:"",l=(g=(I=n._state)==null?void 0:I.sessionId)!=null?g:"",y=n._cfg;if(!(!c||!l||!y)){s.querySelectorAll(".lc-rate-btn").forEach(R=>R.disabled=!0),r.classList.add("lc-rate-btn--active");try{await fetch(`${y.apiBase}/livechat/session/${encodeURIComponent(l)}/message/${encodeURIComponent(c)}/rating`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:y.siteKey,visitorId:y.visitorId,rating:o}),credentials:"omit"})}catch(R){}}})})}),t.querySelectorAll(".lc-chip").forEach(s=>{s.addEventListener("click",()=>{var c;const r=(c=s.getAttribute("data-chip"))!=null?c:"";if(!r)return;const o=n._submitFromChip;if(o)o(r);else{const l=n.querySelector("textarea"),y=n.querySelector(".lc-composer");if(!l||!y)return;l.value=r,l.dispatchEvent(new Event("input",{bubbles:!0})),y.requestSubmit()}})}),t.querySelectorAll(".lc-fb-btn").forEach(s=>{s.addEventListener("click",async()=>{const r=s.closest(".lc-feedback"),o=s.getAttribute("data-rating");if(!r||!o)return;const c=e.sessionId,l=e.cfg;if(c&&l)try{await fetch(`${l.apiBase}/livechat/session/${encodeURIComponent(c)}/feedback`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:l.siteKey,visitorId:l.visitorId,rating:o}),credentials:"omit"})}catch(y){}r.innerHTML="<span>Thanks for the feedback!</span>"})}),Ot(n)}function Ot(n){const e=n.querySelector(".lc-messages");e&&(e.scrollTop=e.scrollHeight)}function Ct(n){const e=n.querySelector(".lc-messages");if(!e||e.querySelector(".lc-typing"))return;const t=document.createElement("div");t.className="lc-typing",t.innerHTML="<span></span><span></span><span></span>",e.appendChild(t),e.scrollTop=e.scrollHeight}function ue(n){n.querySelectorAll(".lc-typing").forEach(e=>e.remove())}function di(n,e,t){let i=!1;try{i=!!localStorage.getItem(Ie)}catch(g){}const s=e.messages,r=s.filter(g=>g.role==="visitor").length,o=s.filter(g=>g.role==="agent").length;let c=null;try{c=localStorage.getItem(Ae)}catch(g){}const l=!!c||!!e.knownName||i,y=s.some(g=>g.id==="identify-name"||g.id==="identify-name-done");!l&&!y&&o>=1&&(e.askedForName=!0,e.messages.push({id:"identify-name",role:"agent",content:"__identify_name__",createdAt:new Date().toISOString()}),t());let x=!1;try{x=!!localStorage.getItem(pe)}catch(g){}const I=s.some(g=>g.id==="identify-email"||g.id==="identify-email-done");!x&&!i&&!I&&r>=ri&&(e.askedForEmail=!0,e.messages.push({id:"identify-email",role:"agent",content:"__identify_email__",createdAt:new Date().toISOString()}),t())}function hi(){try{const n=localStorage.getItem(Ae);return!n||n==="saved"||n==="skipped"?null:n}catch(n){return null}}function pi(n,e,t){n.messages.push({id:"local-"+Date.now(),role:"visitor",content:e,createdAt:new Date().toISOString(),attachments:t}),re(n.messages)}function Qe(n,e,t,i=!1,s,r,o){n.messages.push({id:t||"srv-"+Date.now(),role:i?"operator":"agent",content:e,createdAt:new Date().toISOString(),attachments:s,operatorName:r,operatorAvatarUrl:o}),re(n.messages)}function ui(){var n;try{const e=Date.now(),t=JSON.parse((n=localStorage.getItem(At))!=null?n:"[]").filter(i=>e-i<si);return t.length>=ii?!1:(t.push(e),localStorage.setItem(At,JSON.stringify(t)),!0)}catch(e){return!0}}function fi(){try{return localStorage.getItem(Xe)}catch(n){return null}}function mi(n){try{localStorage.setItem(Xe,n)}catch(e){}}function gi(n,e){if(e)try{localStorage.getItem(`${It}_${n}`)!==e&&(localStorage.removeItem(Te),localStorage.setItem(`${It}_${n}`,e))}catch(t){}}function yi(){try{const n=localStorage.getItem(Te);return n?JSON.parse(n):[]}catch(n){return[]}}function re(n){try{localStorage.setItem(Te,JSON.stringify(n.slice(-50)))}catch(e){}}function Rt(){try{const n=new(window.AudioContext||window.webkitAudioContext),e=n.createOscillator(),t=n.createGain();e.connect(t),t.connect(n.destination),e.type="sine",e.frequency.setValueAtTime(880,n.currentTime),e.frequency.setValueAtTime(1100,n.currentTime+.08),t.gain.setValueAtTime(.12,n.currentTime),t.gain.exponentialRampToValueAtTime(.001,n.currentTime+.35),e.start(n.currentTime),e.stop(n.currentTime+.35)}catch(n){}}function C(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function bi(n){if(!n)return null;const e=n.trim();return/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(e)?e:null}function $t(n,e){let t=n.replace("#","");t.length===3&&(t=t.split("").map(o=>o+o).join(""));const i=parseInt(t.slice(0,2),16),s=parseInt(t.slice(2,4),16),r=parseInt(t.slice(4,6),16);return`rgba(${i}, ${s}, ${r}, ${e})`}function xi(n){if(n.mimeType.startsWith("image/")&&n.url)return`<a href="${K(n.url)}" target="_blank" rel="noopener noreferrer"><img class="lc-attach-img" src="${K(n.url)}" alt="${K(n.originalFilename)}" /></a>`;const t=_i(n.sizeBytes);return`<a class="lc-attach-file" href="${n.url?K(n.url):"#"}" target="_blank" rel="noopener noreferrer">${Ei()}<span>${C(n.originalFilename)}</span><span class="lc-attach-size">${t}</span></a>`}function vi(n){return C(n).replace(/(https?:\/\/[^\s<]+)/g,i=>{const s=i.match(/[.,;:!?)]+$/),r=s?s[0]:"",o=r?i.slice(0,-r.length):i;return`<a href="${K(o)}" target="_blank" rel="noopener noreferrer nofollow">${o}</a>${r}`}).replace(/\n/g,"<br>")}function wi(n){let e=C(n);const t=[];return e=e.replace(/`([^`\n]+)`/g,(i,s)=>(t.push(`<code class="lc-md-code">${s}</code>`),`\0C${t.length-1}\0`)),e=e.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(i,s,r)=>`<a href="${K(r)}" target="_blank" rel="noopener noreferrer nofollow">${s}</a>`),e=e.replace(/\*\*([^*\n]+?)\*\*/g,"<strong>$1</strong>"),e=e.replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s.,;:!?)]|$)/g,"$1<em>$2</em>"),e=e.replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g,(i,s,r)=>{const o=r.match(/[.,;:!?)]+$/),c=o?o[0]:"",l=c?r.slice(0,-c.length):r;return`${s}<a href="${K(l)}" target="_blank" rel="noopener noreferrer nofollow">${l}</a>${c}`}),e=e.replace(/ C(\d+) /g,(i,s)=>{var r;return(r=t[Number(s)])!=null?r:""}),e=e.replace(/\n/g,"<br>"),e}function K(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function _i(n){return n<1024?`${n} B`:n<1024*1024?`${(n/1024).toFixed(0)} KB`:`${(n/1024/1024).toFixed(1)} MB`}function W(n,e,t=3500){const i=n.querySelector(".lc-toast");i&&(i.textContent=e,i.style.display="block",clearTimeout(i._timer),i._timer=setTimeout(()=>{i.style.display="none"},t))}function Ze(n){return n.trim().split(/\s+/).map(e=>{var t;return(t=e[0])!=null?t:""}).join("").slice(0,2).toUpperCase()}function ki(n){try{const e=new Date(n);return isNaN(e.getTime())?"":e.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}catch(e){return""}}function Si(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.58 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48"/></svg>'}function Ei(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'}function Ti(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'}function Ii(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'}function Bt(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'}function Nt(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'}function Ai(){return'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>'}function Li(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.36L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.36L3 16"/><path d="M3 21v-5h5"/></svg>'}function Oi(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'}function Ci(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'}function qt(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/></svg>'}function Ri(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'}function $i(n,e){return!n.length&&(e!=null&&e.trim())?`<div class="lc-header-avatars"><div class="lc-op-avatar lc-op-initials" style="z-index:3">${C(Ze(e.trim()))}</div></div>`:n.length?`<div class="lc-header-avatars">${n.slice(0,3).map((s,r)=>{const o=r===0?"":"margin-left:-10px;",c=`z-index:${3-r};`;return s.avatarUrl?`<img class="lc-op-avatar" src="${K(s.avatarUrl)}" alt="${C(s.name)}" style="${c}${o}">`:`<div class="lc-op-avatar lc-op-initials" style="${c}${o}">${C(Ze(s.name))}</div>`}).join("")}</div>`:`<div class="lc-header-avatar">${Ii()}</div>`}let Pt="",fe=null,Oe=null;const Bi=3e4;function Ni(n){Mt(n),Pi(n),window.addEventListener("popstate",()=>et(n)),window.addEventListener("pagehide",()=>{fe&&$e(n,fe)}),qi(n)}function qi(n){const e=()=>{document.visibilityState==="visible"&&st(n,{url:location.href,title:document.title})};setInterval(e,Bi),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&e()})}function Pi(n){const e={pushState:history.pushState,replaceState:history.replaceState};history.pushState=function(...t){const i=e.pushState.apply(this,t);return et(n),i},history.replaceState=function(...t){const i=e.replaceState.apply(this,t);return et(n),i}}function et(n){Oe&&clearTimeout(Oe),Oe=setTimeout(()=>Mt(n),300)}async function Mt(n){var t;Oe=null;const e=location.pathname+location.search;if(e!==Pt){Pt=e,fe&&$e(n,fe);try{fe=(t=(await it(n,{url:location.href,path:location.pathname,title:document.title,referrer:document.referrer,language:navigator.language})).pageviewId)!=null?t:null}catch(i){}}}const Dt="livechat_visitor_id";function Mi(){const n=Di();if(!n)return null;const e=n.getAttribute("data-site");if(!e)return null;const t=n.getAttribute("data-api")||ji(n)||"",i=zi();let s;try{const r=n.getAttribute("data-context");r&&(s=JSON.parse(r))}catch(r){}try{const r=window.CortexLivechat;r!=null&&r.context&&typeof r.context=="object"&&(s=ee(ee({},s),r.context))}catch(r){}return{siteKey:e,visitorId:i,apiBase:t,context:s}}function Di(){const n=document.querySelectorAll("script[data-site]");return n.length?n[n.length-1]:null}function ji(n){if(!n.src)return null;try{const e=new URL(n.src);return`${e.protocol}//${e.host}`}catch(e){return null}}function zi(){try{const n=localStorage.getItem(Dt);if(n)return n;const e=jt();return localStorage.setItem(Dt,e),e}catch(n){return jt()}}function jt(){if(typeof crypto!="undefined"&&crypto.randomUUID)return crypto.randomUUID();let n=Date.now();return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,e=>{const t=(n+Math.random()*16)%16|0;return n=Math.floor(n/16),(e==="x"?t:t&3|8).toString(16)})}const zt="livechat_build",Ui=["livechat_messages_cache","livechat_session_id","livechat_identify_dismissed","livechat_send_log","livechat_proactive_seen"];function Hi(){try{localStorage.getItem(zt)!=="morga9mw"&&(Ui.forEach(n=>localStorage.removeItem(n)),localStorage.setItem(zt,"morga9mw"))}catch(n){}}(function(){var i;if(typeof window=="undefined"||(i=window.__livechat__)!=null&&i.mounted)return;Hi();const e=Mi();if(!e)return;window.__livechat__={mounted:!0,siteKey:e.siteKey,visitorId:e.visitorId},Ni(e);const t=async()=>{const s=await F(e);oi(e,s!=null?s:void 0)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",t):t()})()})();
