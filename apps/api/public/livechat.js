var Fn=Object.defineProperty;var nt=Object.getOwnPropertySymbols;var zn=Object.prototype.hasOwnProperty,Hn=Object.prototype.propertyIsEnumerable;var st=(B,v,x)=>v in B?Fn(B,v,{enumerable:!0,configurable:!0,writable:!0,value:x}):B[v]=x,it=(B,v)=>{for(var x in v||(v={}))zn.call(v,x)&&st(B,x,v[x]);if(nt)for(var x of nt(v))Hn.call(v,x)&&st(B,x,v[x]);return B};(function(){"use strict";async function B(n){try{const e=await fetch(`${n.apiBase}/livechat/config?siteKey=${encodeURIComponent(n.siteKey)}`,{method:"GET",credentials:"omit"});return e.ok?await e.json():null}catch(e){return null}}async function v(n,e,t){const s=new FormData;s.append("siteKey",n.siteKey),s.append("visitorId",n.visitorId),s.append("sessionId",e),s.append("file",t,t.name);const i=await fetch(`${n.apiBase}/livechat/upload`,{method:"POST",body:s,credentials:"omit"});if(!i.ok){const r=await i.text().catch(()=>"");throw new Error(`${i.status} ${i.statusText}${r?` — ${r}`:""}`)}return i.json()}async function x(n,e){const t=await fetch(n,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e),credentials:"omit"});if(!t.ok){const s=await t.text().catch(()=>"");throw new Error(`${t.status} ${t.statusText}${s?` — ${s}`:""}`)}return t.json()}function rt(n,e){return x(`${n.apiBase}/livechat/track/pageview`,it({siteKey:n.siteKey,visitorId:n.visitorId},e))}function ot(n,e){return x(`${n.apiBase}/livechat/track/heartbeat`,{siteKey:n.siteKey,visitorId:n.visitorId,url:e.url,title:e.title}).catch(()=>{})}function _e(n,e){const t=`${n.apiBase}/livechat/track/leave`,s=JSON.stringify({siteKey:n.siteKey,visitorId:n.visitorId,pageviewId:e});if(navigator.sendBeacon){const i=new Blob([s],{type:"application/json"});navigator.sendBeacon(t,i);return}fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:s,keepalive:!0}).catch(()=>{})}function at(n,e,t,s){return x(`${n.apiBase}/livechat/message`,{siteKey:n.siteKey,visitorId:n.visitorId,content:e,attachmentIds:t&&t.length?t:void 0,meta:s})}function ct(n,e){return x(`${n.apiBase}/livechat/identify`,{siteKey:n.siteKey,visitorId:n.visitorId,email:e.email,name:e.name})}const T=Object.create(null);T.open="0",T.close="1",T.ping="2",T.pong="3",T.message="4",T.upgrade="5",T.noop="6";const K=Object.create(null);Object.keys(T).forEach(n=>{K[T[n]]=n});const se={type:"error",data:"parser error"},ke=typeof Blob=="function"||typeof Blob!="undefined"&&Object.prototype.toString.call(Blob)==="[object BlobConstructor]",Ee=typeof ArrayBuffer=="function",Se=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n&&n.buffer instanceof ArrayBuffer,ie=({type:n,data:e},t,s)=>ke&&e instanceof Blob?t?s(e):Te(e,s):Ee&&(e instanceof ArrayBuffer||Se(e))?t?s(e):Te(new Blob([e]),s):s(T[n]+(e||"")),Te=(n,e)=>{const t=new FileReader;return t.onload=function(){const s=t.result.split(",")[1];e("b"+(s||""))},t.readAsDataURL(n)};function Ae(n){return n instanceof Uint8Array?n:n instanceof ArrayBuffer?new Uint8Array(n):new Uint8Array(n.buffer,n.byteOffset,n.byteLength)}let re;function lt(n,e){if(ke&&n.data instanceof Blob)return n.data.arrayBuffer().then(Ae).then(e);if(Ee&&(n.data instanceof ArrayBuffer||Se(n.data)))return e(Ae(n.data));ie(n,!1,t=>{re||(re=new TextEncoder),e(re.encode(t))})}const Be="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",P=typeof Uint8Array=="undefined"?[]:new Uint8Array(256);for(let n=0;n<Be.length;n++)P[Be.charCodeAt(n)]=n;const ht=n=>{let e=n.length*.75,t=n.length,s,i=0,r,o,a,c;n[n.length-1]==="="&&(e--,n[n.length-2]==="="&&e--);const f=new ArrayBuffer(e),h=new Uint8Array(f);for(s=0;s<t;s+=4)r=P[n.charCodeAt(s)],o=P[n.charCodeAt(s+1)],a=P[n.charCodeAt(s+2)],c=P[n.charCodeAt(s+3)],h[i++]=r<<2|o>>4,h[i++]=(o&15)<<4|a>>2,h[i++]=(a&3)<<6|c&63;return f},dt=typeof ArrayBuffer=="function",oe=(n,e)=>{if(typeof n!="string")return{type:"message",data:Oe(n,e)};const t=n.charAt(0);return t==="b"?{type:"message",data:ut(n.substring(1),e)}:K[t]?n.length>1?{type:K[t],data:n.substring(1)}:{type:K[t]}:se},ut=(n,e)=>{if(dt){const t=ht(n);return Oe(t,e)}else return{base64:!0,data:n}},Oe=(n,e)=>{switch(e){case"blob":return n instanceof Blob?n:new Blob([n]);case"arraybuffer":default:return n instanceof ArrayBuffer?n:n.buffer}},Re="",pt=(n,e)=>{const t=n.length,s=new Array(t);let i=0;n.forEach((r,o)=>{ie(r,!1,a=>{s[o]=a,++i===t&&e(s.join(Re))})})},ft=(n,e)=>{const t=n.split(Re),s=[];for(let i=0;i<t.length;i++){const r=oe(t[i],e);if(s.push(r),r.type==="error")break}return s};function gt(){return new TransformStream({transform(n,e){lt(n,t=>{const s=t.length;let i;if(s<126)i=new Uint8Array(1),new DataView(i.buffer).setUint8(0,s);else if(s<65536){i=new Uint8Array(3);const r=new DataView(i.buffer);r.setUint8(0,126),r.setUint16(1,s)}else{i=new Uint8Array(9);const r=new DataView(i.buffer);r.setUint8(0,127),r.setBigUint64(1,BigInt(s))}n.data&&typeof n.data!="string"&&(i[0]|=128),e.enqueue(i),e.enqueue(t)})}})}let ae;function W(n){return n.reduce((e,t)=>e+t.length,0)}function Y(n,e){if(n[0].length===e)return n.shift();const t=new Uint8Array(e);let s=0;for(let i=0;i<e;i++)t[i]=n[0][s++],s===n[0].length&&(n.shift(),s=0);return n.length&&s<n[0].length&&(n[0]=n[0].slice(s)),t}function mt(n,e){ae||(ae=new TextDecoder);const t=[];let s=0,i=-1,r=!1;return new TransformStream({transform(o,a){for(t.push(o);;){if(s===0){if(W(t)<1)break;const c=Y(t,1);r=(c[0]&128)===128,i=c[0]&127,i<126?s=3:i===126?s=1:s=2}else if(s===1){if(W(t)<2)break;const c=Y(t,2);i=new DataView(c.buffer,c.byteOffset,c.length).getUint16(0),s=3}else if(s===2){if(W(t)<8)break;const c=Y(t,8),f=new DataView(c.buffer,c.byteOffset,c.length),h=f.getUint32(0);if(h>Math.pow(2,21)-1){a.enqueue(se);break}i=h*Math.pow(2,32)+f.getUint32(4),s=3}else{if(W(t)<i)break;const c=Y(t,i);a.enqueue(oe(r?c:ae.decode(c),e)),s=0}if(i===0||i>n){a.enqueue(se);break}}}})}const Ce=4;function m(n){if(n)return yt(n)}function yt(n){for(var e in m.prototype)n[e]=m.prototype[e];return n}m.prototype.on=m.prototype.addEventListener=function(n,e){return this._callbacks=this._callbacks||{},(this._callbacks["$"+n]=this._callbacks["$"+n]||[]).push(e),this},m.prototype.once=function(n,e){function t(){this.off(n,t),e.apply(this,arguments)}return t.fn=e,this.on(n,t),this},m.prototype.off=m.prototype.removeListener=m.prototype.removeAllListeners=m.prototype.removeEventListener=function(n,e){if(this._callbacks=this._callbacks||{},arguments.length==0)return this._callbacks={},this;var t=this._callbacks["$"+n];if(!t)return this;if(arguments.length==1)return delete this._callbacks["$"+n],this;for(var s,i=0;i<t.length;i++)if(s=t[i],s===e||s.fn===e){t.splice(i,1);break}return t.length===0&&delete this._callbacks["$"+n],this},m.prototype.emit=function(n){this._callbacks=this._callbacks||{};for(var e=new Array(arguments.length-1),t=this._callbacks["$"+n],s=1;s<arguments.length;s++)e[s-1]=arguments[s];if(t){t=t.slice(0);for(var s=0,i=t.length;s<i;++s)t[s].apply(this,e)}return this},m.prototype.emitReserved=m.prototype.emit,m.prototype.listeners=function(n){return this._callbacks=this._callbacks||{},this._callbacks["$"+n]||[]},m.prototype.hasListeners=function(n){return!!this.listeners(n).length};const j=typeof Promise=="function"&&typeof Promise.resolve=="function"?e=>Promise.resolve().then(e):(e,t)=>t(e,0),_=typeof self!="undefined"?self:typeof window!="undefined"?window:Function("return this")(),bt="arraybuffer";function Un(){}function Ie(n,...e){return e.reduce((t,s)=>(n.hasOwnProperty(s)&&(t[s]=n[s]),t),{})}const xt=_.setTimeout,vt=_.clearTimeout;function J(n,e){e.useNativeTimers?(n.setTimeoutFn=xt.bind(_),n.clearTimeoutFn=vt.bind(_)):(n.setTimeoutFn=_.setTimeout.bind(_),n.clearTimeoutFn=_.clearTimeout.bind(_))}const wt=1.33;function _t(n){return typeof n=="string"?kt(n):Math.ceil((n.byteLength||n.size)*wt)}function kt(n){let e=0,t=0;for(let s=0,i=n.length;s<i;s++)e=n.charCodeAt(s),e<128?t+=1:e<2048?t+=2:e<55296||e>=57344?t+=3:(s++,t+=4);return t}function Le(){return Date.now().toString(36).substring(3)+Math.random().toString(36).substring(2,5)}function Et(n){let e="";for(let t in n)n.hasOwnProperty(t)&&(e.length&&(e+="&"),e+=encodeURIComponent(t)+"="+encodeURIComponent(n[t]));return e}function St(n){let e={},t=n.split("&");for(let s=0,i=t.length;s<i;s++){let r=t[s].split("=");e[decodeURIComponent(r[0])]=decodeURIComponent(r[1])}return e}class Tt extends Error{constructor(e,t,s){super(e),this.description=t,this.context=s,this.type="TransportError"}}class ce extends m{constructor(e){super(),this.writable=!1,J(this,e),this.opts=e,this.query=e.query,this.socket=e.socket,this.supportsBinary=!e.forceBase64}onError(e,t,s){return super.emitReserved("error",new Tt(e,t,s)),this}open(){return this.readyState="opening",this.doOpen(),this}close(){return(this.readyState==="opening"||this.readyState==="open")&&(this.doClose(),this.onClose()),this}send(e){this.readyState==="open"&&this.write(e)}onOpen(){this.readyState="open",this.writable=!0,super.emitReserved("open")}onData(e){const t=oe(e,this.socket.binaryType);this.onPacket(t)}onPacket(e){super.emitReserved("packet",e)}onClose(e){this.readyState="closed",super.emitReserved("close",e)}pause(e){}createUri(e,t={}){return e+"://"+this._hostname()+this._port()+this.opts.path+this._query(t)}_hostname(){const e=this.opts.hostname;return e.indexOf(":")===-1?e:"["+e+"]"}_port(){return this.opts.port&&(this.opts.secure&&Number(this.opts.port)!==443||!this.opts.secure&&Number(this.opts.port)!==80)?":"+this.opts.port:""}_query(e){const t=Et(e);return t.length?"?"+t:""}}class At extends ce{constructor(){super(...arguments),this._polling=!1}get name(){return"polling"}doOpen(){this._poll()}pause(e){this.readyState="pausing";const t=()=>{this.readyState="paused",e()};if(this._polling||!this.writable){let s=0;this._polling&&(s++,this.once("pollComplete",function(){--s||t()})),this.writable||(s++,this.once("drain",function(){--s||t()}))}else t()}_poll(){this._polling=!0,this.doPoll(),this.emitReserved("poll")}onData(e){const t=s=>{if(this.readyState==="opening"&&s.type==="open"&&this.onOpen(),s.type==="close")return this.onClose({description:"transport closed by the server"}),!1;this.onPacket(s)};ft(e,this.socket.binaryType).forEach(t),this.readyState!=="closed"&&(this._polling=!1,this.emitReserved("pollComplete"),this.readyState==="open"&&this._poll())}doClose(){const e=()=>{this.write([{type:"close"}])};this.readyState==="open"?e():this.once("open",e)}write(e){this.writable=!1,pt(e,t=>{this.doWrite(t,()=>{this.writable=!0,this.emitReserved("drain")})})}uri(){const e=this.opts.secure?"https":"http",t=this.query||{};return this.opts.timestampRequests!==!1&&(t[this.opts.timestampParam]=Le()),!this.supportsBinary&&!t.sid&&(t.b64=1),this.createUri(e,t)}}let Ne=!1;try{Ne=typeof XMLHttpRequest!="undefined"&&"withCredentials"in new XMLHttpRequest}catch(n){}const Bt=Ne;function Ot(){}class Rt extends At{constructor(e){if(super(e),typeof location!="undefined"){const t=location.protocol==="https:";let s=location.port;s||(s=t?"443":"80"),this.xd=typeof location!="undefined"&&e.hostname!==location.hostname||s!==e.port}}doWrite(e,t){const s=this.request({method:"POST",data:e});s.on("success",t),s.on("error",(i,r)=>{this.onError("xhr post error",i,r)})}doPoll(){const e=this.request();e.on("data",this.onData.bind(this)),e.on("error",(t,s)=>{this.onError("xhr poll error",t,s)}),this.pollXhr=e}}class A extends m{constructor(e,t,s){super(),this.createRequest=e,J(this,s),this._opts=s,this._method=s.method||"GET",this._uri=t,this._data=s.data!==void 0?s.data:null,this._create()}_create(){var e;const t=Ie(this._opts,"agent","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","autoUnref");t.xdomain=!!this._opts.xd;const s=this._xhr=this.createRequest(t);try{s.open(this._method,this._uri,!0);try{if(this._opts.extraHeaders){s.setDisableHeaderCheck&&s.setDisableHeaderCheck(!0);for(let i in this._opts.extraHeaders)this._opts.extraHeaders.hasOwnProperty(i)&&s.setRequestHeader(i,this._opts.extraHeaders[i])}}catch(i){}if(this._method==="POST")try{s.setRequestHeader("Content-type","text/plain;charset=UTF-8")}catch(i){}try{s.setRequestHeader("Accept","*/*")}catch(i){}(e=this._opts.cookieJar)===null||e===void 0||e.addCookies(s),"withCredentials"in s&&(s.withCredentials=this._opts.withCredentials),this._opts.requestTimeout&&(s.timeout=this._opts.requestTimeout),s.onreadystatechange=()=>{var i;s.readyState===3&&((i=this._opts.cookieJar)===null||i===void 0||i.parseCookies(s.getResponseHeader("set-cookie"))),s.readyState===4&&(s.status===200||s.status===1223?this._onLoad():this.setTimeoutFn(()=>{this._onError(typeof s.status=="number"?s.status:0)},0))},s.send(this._data)}catch(i){this.setTimeoutFn(()=>{this._onError(i)},0);return}typeof document!="undefined"&&(this._index=A.requestsCount++,A.requests[this._index]=this)}_onError(e){this.emitReserved("error",e,this._xhr),this._cleanup(!0)}_cleanup(e){if(!(typeof this._xhr=="undefined"||this._xhr===null)){if(this._xhr.onreadystatechange=Ot,e)try{this._xhr.abort()}catch(t){}typeof document!="undefined"&&delete A.requests[this._index],this._xhr=null}}_onLoad(){const e=this._xhr.responseText;e!==null&&(this.emitReserved("data",e),this.emitReserved("success"),this._cleanup())}abort(){this._cleanup()}}if(A.requestsCount=0,A.requests={},typeof document!="undefined"){if(typeof attachEvent=="function")attachEvent("onunload",qe);else if(typeof addEventListener=="function"){const n="onpagehide"in _?"pagehide":"unload";addEventListener(n,qe,!1)}}function qe(){for(let n in A.requests)A.requests.hasOwnProperty(n)&&A.requests[n].abort()}const Ct=(function(){const n=Pe({xdomain:!1});return n&&n.responseType!==null})();class It extends Rt{constructor(e){super(e);const t=e&&e.forceBase64;this.supportsBinary=Ct&&!t}request(e={}){return Object.assign(e,{xd:this.xd},this.opts),new A(Pe,this.uri(),e)}}function Pe(n){const e=n.xdomain;try{if(typeof XMLHttpRequest!="undefined"&&(!e||Bt))return new XMLHttpRequest}catch(t){}if(!e)try{return new _[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP")}catch(t){}}const De=typeof navigator!="undefined"&&typeof navigator.product=="string"&&navigator.product.toLowerCase()==="reactnative";class Lt extends ce{get name(){return"websocket"}doOpen(){const e=this.uri(),t=this.opts.protocols,s=De?{}:Ie(this.opts,"agent","perMessageDeflate","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","localAddress","protocolVersion","origin","maxPayload","family","checkServerIdentity");this.opts.extraHeaders&&(s.headers=this.opts.extraHeaders);try{this.ws=this.createSocket(e,t,s)}catch(i){return this.emitReserved("error",i)}this.ws.binaryType=this.socket.binaryType,this.addEventListeners()}addEventListeners(){this.ws.onopen=()=>{this.opts.autoUnref&&this.ws._socket.unref(),this.onOpen()},this.ws.onclose=e=>this.onClose({description:"websocket connection closed",context:e}),this.ws.onmessage=e=>this.onData(e.data),this.ws.onerror=e=>this.onError("websocket error",e)}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const s=e[t],i=t===e.length-1;ie(s,this.supportsBinary,r=>{try{this.doWrite(s,r)}catch(o){}i&&j(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){typeof this.ws!="undefined"&&(this.ws.onerror=()=>{},this.ws.close(),this.ws=null)}uri(){const e=this.opts.secure?"wss":"ws",t=this.query||{};return this.opts.timestampRequests&&(t[this.opts.timestampParam]=Le()),this.supportsBinary||(t.b64=1),this.createUri(e,t)}}const le=_.WebSocket||_.MozWebSocket;class Nt extends Lt{createSocket(e,t,s){return De?new le(e,t,s):t?new le(e,t):new le(e)}doWrite(e,t){this.ws.send(t)}}class qt extends ce{get name(){return"webtransport"}doOpen(){try{this._transport=new WebTransport(this.createUri("https"),this.opts.transportOptions[this.name])}catch(e){return this.emitReserved("error",e)}this._transport.closed.then(()=>{this.onClose()}).catch(e=>{this.onError("webtransport error",e)}),this._transport.ready.then(()=>{this._transport.createBidirectionalStream().then(e=>{const t=mt(Number.MAX_SAFE_INTEGER,this.socket.binaryType),s=e.readable.pipeThrough(t).getReader(),i=gt();i.readable.pipeTo(e.writable),this._writer=i.writable.getWriter();const r=()=>{s.read().then(({done:a,value:c})=>{a||(this.onPacket(c),r())}).catch(a=>{})};r();const o={type:"open"};this.query.sid&&(o.data=`{"sid":"${this.query.sid}"}`),this._writer.write(o).then(()=>this.onOpen())})})}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const s=e[t],i=t===e.length-1;this._writer.write(s).then(()=>{i&&j(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){var e;(e=this._transport)===null||e===void 0||e.close()}}const Pt={websocket:Nt,webtransport:qt,polling:It},Dt=/^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,$t=["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"];function he(n){if(n.length>8e3)throw"URI too long";const e=n,t=n.indexOf("["),s=n.indexOf("]");t!=-1&&s!=-1&&(n=n.substring(0,t)+n.substring(t,s).replace(/:/g,";")+n.substring(s,n.length));let i=Dt.exec(n||""),r={},o=14;for(;o--;)r[$t[o]]=i[o]||"";return t!=-1&&s!=-1&&(r.source=e,r.host=r.host.substring(1,r.host.length-1).replace(/;/g,":"),r.authority=r.authority.replace("[","").replace("]","").replace(/;/g,":"),r.ipv6uri=!0),r.pathNames=Mt(r,r.path),r.queryKey=Ft(r,r.query),r}function Mt(n,e){const t=/\/{2,9}/g,s=e.replace(t,"/").split("/");return(e.slice(0,1)=="/"||e.length===0)&&s.splice(0,1),e.slice(-1)=="/"&&s.splice(s.length-1,1),s}function Ft(n,e){const t={};return e.replace(/(?:^|&)([^&=]*)=?([^&]*)/g,function(s,i,r){i&&(t[i]=r)}),t}const de=typeof addEventListener=="function"&&typeof removeEventListener=="function",X=[];de&&addEventListener("offline",()=>{X.forEach(n=>n())},!1);class R extends m{constructor(e,t){if(super(),this.binaryType=bt,this.writeBuffer=[],this._prevBufferLen=0,this._pingInterval=-1,this._pingTimeout=-1,this._maxPayload=-1,this._pingTimeoutTime=1/0,e&&typeof e=="object"&&(t=e,e=null),e){const s=he(e);t.hostname=s.host,t.secure=s.protocol==="https"||s.protocol==="wss",t.port=s.port,s.query&&(t.query=s.query)}else t.host&&(t.hostname=he(t.host).host);J(this,t),this.secure=t.secure!=null?t.secure:typeof location!="undefined"&&location.protocol==="https:",t.hostname&&!t.port&&(t.port=this.secure?"443":"80"),this.hostname=t.hostname||(typeof location!="undefined"?location.hostname:"localhost"),this.port=t.port||(typeof location!="undefined"&&location.port?location.port:this.secure?"443":"80"),this.transports=[],this._transportsByName={},t.transports.forEach(s=>{const i=s.prototype.name;this.transports.push(i),this._transportsByName[i]=s}),this.opts=Object.assign({path:"/engine.io",agent:!1,withCredentials:!1,upgrade:!0,timestampParam:"t",rememberUpgrade:!1,addTrailingSlash:!0,rejectUnauthorized:!0,perMessageDeflate:{threshold:1024},transportOptions:{},closeOnBeforeunload:!1},t),this.opts.path=this.opts.path.replace(/\/$/,"")+(this.opts.addTrailingSlash?"/":""),typeof this.opts.query=="string"&&(this.opts.query=St(this.opts.query)),de&&(this.opts.closeOnBeforeunload&&(this._beforeunloadEventListener=()=>{this.transport&&(this.transport.removeAllListeners(),this.transport.close())},addEventListener("beforeunload",this._beforeunloadEventListener,!1)),this.hostname!=="localhost"&&(this._offlineEventListener=()=>{this._onClose("transport close",{description:"network connection lost"})},X.push(this._offlineEventListener))),this.opts.withCredentials&&(this._cookieJar=void 0),this._open()}createTransport(e){const t=Object.assign({},this.opts.query);t.EIO=Ce,t.transport=e,this.id&&(t.sid=this.id);const s=Object.assign({},this.opts,{query:t,socket:this,hostname:this.hostname,secure:this.secure,port:this.port},this.opts.transportOptions[e]);return new this._transportsByName[e](s)}_open(){if(this.transports.length===0){this.setTimeoutFn(()=>{this.emitReserved("error","No transports available")},0);return}const e=this.opts.rememberUpgrade&&R.priorWebsocketSuccess&&this.transports.indexOf("websocket")!==-1?"websocket":this.transports[0];this.readyState="opening";const t=this.createTransport(e);t.open(),this.setTransport(t)}setTransport(e){this.transport&&this.transport.removeAllListeners(),this.transport=e,e.on("drain",this._onDrain.bind(this)).on("packet",this._onPacket.bind(this)).on("error",this._onError.bind(this)).on("close",t=>this._onClose("transport close",t))}onOpen(){this.readyState="open",R.priorWebsocketSuccess=this.transport.name==="websocket",this.emitReserved("open"),this.flush()}_onPacket(e){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing")switch(this.emitReserved("packet",e),this.emitReserved("heartbeat"),e.type){case"open":this.onHandshake(JSON.parse(e.data));break;case"ping":this._sendPacket("pong"),this.emitReserved("ping"),this.emitReserved("pong"),this._resetPingTimeout();break;case"error":const t=new Error("server error");t.code=e.data,this._onError(t);break;case"message":this.emitReserved("data",e.data),this.emitReserved("message",e.data);break}}onHandshake(e){this.emitReserved("handshake",e),this.id=e.sid,this.transport.query.sid=e.sid,this._pingInterval=e.pingInterval,this._pingTimeout=e.pingTimeout,this._maxPayload=e.maxPayload,this.onOpen(),this.readyState!=="closed"&&this._resetPingTimeout()}_resetPingTimeout(){this.clearTimeoutFn(this._pingTimeoutTimer);const e=this._pingInterval+this._pingTimeout;this._pingTimeoutTime=Date.now()+e,this._pingTimeoutTimer=this.setTimeoutFn(()=>{this._onClose("ping timeout")},e),this.opts.autoUnref&&this._pingTimeoutTimer.unref()}_onDrain(){this.writeBuffer.splice(0,this._prevBufferLen),this._prevBufferLen=0,this.writeBuffer.length===0?this.emitReserved("drain"):this.flush()}flush(){if(this.readyState!=="closed"&&this.transport.writable&&!this.upgrading&&this.writeBuffer.length){const e=this._getWritablePackets();this.transport.send(e),this._prevBufferLen=e.length,this.emitReserved("flush")}}_getWritablePackets(){if(!(this._maxPayload&&this.transport.name==="polling"&&this.writeBuffer.length>1))return this.writeBuffer;let t=1;for(let s=0;s<this.writeBuffer.length;s++){const i=this.writeBuffer[s].data;if(i&&(t+=_t(i)),s>0&&t>this._maxPayload)return this.writeBuffer.slice(0,s);t+=2}return this.writeBuffer}_hasPingExpired(){if(!this._pingTimeoutTime)return!0;const e=Date.now()>this._pingTimeoutTime;return e&&(this._pingTimeoutTime=0,j(()=>{this._onClose("ping timeout")},this.setTimeoutFn)),e}write(e,t,s){return this._sendPacket("message",e,t,s),this}send(e,t,s){return this._sendPacket("message",e,t,s),this}_sendPacket(e,t,s,i){if(typeof t=="function"&&(i=t,t=void 0),typeof s=="function"&&(i=s,s=null),this.readyState==="closing"||this.readyState==="closed")return;s=s||{},s.compress=s.compress!==!1;const r={type:e,data:t,options:s};this.emitReserved("packetCreate",r),this.writeBuffer.push(r),i&&this.once("flush",i),this.flush()}close(){const e=()=>{this._onClose("forced close"),this.transport.close()},t=()=>{this.off("upgrade",t),this.off("upgradeError",t),e()},s=()=>{this.once("upgrade",t),this.once("upgradeError",t)};return(this.readyState==="opening"||this.readyState==="open")&&(this.readyState="closing",this.writeBuffer.length?this.once("drain",()=>{this.upgrading?s():e()}):this.upgrading?s():e()),this}_onError(e){if(R.priorWebsocketSuccess=!1,this.opts.tryAllTransports&&this.transports.length>1&&this.readyState==="opening")return this.transports.shift(),this._open();this.emitReserved("error",e),this._onClose("transport error",e)}_onClose(e,t){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing"){if(this.clearTimeoutFn(this._pingTimeoutTimer),this.transport.removeAllListeners("close"),this.transport.close(),this.transport.removeAllListeners(),de&&(this._beforeunloadEventListener&&removeEventListener("beforeunload",this._beforeunloadEventListener,!1),this._offlineEventListener)){const s=X.indexOf(this._offlineEventListener);s!==-1&&X.splice(s,1)}this.readyState="closed",this.id=null,this.emitReserved("close",e,t),this.writeBuffer=[],this._prevBufferLen=0}}}R.protocol=Ce;class zt extends R{constructor(){super(...arguments),this._upgrades=[]}onOpen(){if(super.onOpen(),this.readyState==="open"&&this.opts.upgrade)for(let e=0;e<this._upgrades.length;e++)this._probe(this._upgrades[e])}_probe(e){let t=this.createTransport(e),s=!1;R.priorWebsocketSuccess=!1;const i=()=>{s||(t.send([{type:"ping",data:"probe"}]),t.once("packet",g=>{if(!s)if(g.type==="pong"&&g.data==="probe"){if(this.upgrading=!0,this.emitReserved("upgrading",t),!t)return;R.priorWebsocketSuccess=t.name==="websocket",this.transport.pause(()=>{s||this.readyState!=="closed"&&(h(),this.setTransport(t),t.send([{type:"upgrade"}]),this.emitReserved("upgrade",t),t=null,this.upgrading=!1,this.flush())})}else{const k=new Error("probe error");k.transport=t.name,this.emitReserved("upgradeError",k)}}))};function r(){s||(s=!0,h(),t.close(),t=null)}const o=g=>{const k=new Error("probe error: "+g);k.transport=t.name,r(),this.emitReserved("upgradeError",k)};function a(){o("transport closed")}function c(){o("socket closed")}function f(g){t&&g.name!==t.name&&r()}const h=()=>{t.removeListener("open",i),t.removeListener("error",o),t.removeListener("close",a),this.off("close",c),this.off("upgrading",f)};t.once("open",i),t.once("error",o),t.once("close",a),this.once("close",c),this.once("upgrading",f),this._upgrades.indexOf("webtransport")!==-1&&e!=="webtransport"?this.setTimeoutFn(()=>{s||t.open()},200):t.open()}onHandshake(e){this._upgrades=this._filterUpgrades(e.upgrades),super.onHandshake(e)}_filterUpgrades(e){const t=[];for(let s=0;s<e.length;s++)~this.transports.indexOf(e[s])&&t.push(e[s]);return t}}let Ht=class extends zt{constructor(e,t={}){const s=typeof e=="object"?e:t;(!s.transports||s.transports&&typeof s.transports[0]=="string")&&(s.transports=(s.transports||["polling","websocket","webtransport"]).map(i=>Pt[i]).filter(i=>!!i)),super(e,s)}};function Ut(n,e="",t){let s=n;t=t||typeof location!="undefined"&&location,n==null&&(n=t.protocol+"//"+t.host),typeof n=="string"&&(n.charAt(0)==="/"&&(n.charAt(1)==="/"?n=t.protocol+n:n=t.host+n),/^(https?|wss?):\/\//.test(n)||(typeof t!="undefined"?n=t.protocol+"//"+n:n="https://"+n),s=he(n)),s.port||(/^(http|ws)$/.test(s.protocol)?s.port="80":/^(http|ws)s$/.test(s.protocol)&&(s.port="443")),s.path=s.path||"/";const r=s.host.indexOf(":")!==-1?"["+s.host+"]":s.host;return s.id=s.protocol+"://"+r+":"+s.port+e,s.href=s.protocol+"://"+r+(t&&t.port===s.port?"":":"+s.port),s}const Vt=typeof ArrayBuffer=="function",Kt=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n.buffer instanceof ArrayBuffer,$e=Object.prototype.toString,Wt=typeof Blob=="function"||typeof Blob!="undefined"&&$e.call(Blob)==="[object BlobConstructor]",Yt=typeof File=="function"||typeof File!="undefined"&&$e.call(File)==="[object FileConstructor]";function ue(n){return Vt&&(n instanceof ArrayBuffer||Kt(n))||Wt&&n instanceof Blob||Yt&&n instanceof File}function Q(n,e){if(!n||typeof n!="object")return!1;if(Array.isArray(n)){for(let t=0,s=n.length;t<s;t++)if(Q(n[t]))return!0;return!1}if(ue(n))return!0;if(n.toJSON&&typeof n.toJSON=="function"&&arguments.length===1)return Q(n.toJSON(),!0);for(const t in n)if(Object.prototype.hasOwnProperty.call(n,t)&&Q(n[t]))return!0;return!1}function jt(n){const e=[],t=n.data,s=n;return s.data=pe(t,e),s.attachments=e.length,{packet:s,buffers:e}}function pe(n,e){if(!n)return n;if(ue(n)){const t={_placeholder:!0,num:e.length};return e.push(n),t}else if(Array.isArray(n)){const t=new Array(n.length);for(let s=0;s<n.length;s++)t[s]=pe(n[s],e);return t}else if(typeof n=="object"&&!(n instanceof Date)){const t={};for(const s in n)Object.prototype.hasOwnProperty.call(n,s)&&(t[s]=pe(n[s],e));return t}return n}function Jt(n,e){return n.data=fe(n.data,e),delete n.attachments,n}function fe(n,e){if(!n)return n;if(n&&n._placeholder===!0){if(typeof n.num=="number"&&n.num>=0&&n.num<e.length)return e[n.num];throw new Error("illegal attachments")}else if(Array.isArray(n))for(let t=0;t<n.length;t++)n[t]=fe(n[t],e);else if(typeof n=="object")for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&(n[t]=fe(n[t],e));return n}const Xt=["connect","connect_error","disconnect","disconnecting","newListener","removeListener"];var l;(function(n){n[n.CONNECT=0]="CONNECT",n[n.DISCONNECT=1]="DISCONNECT",n[n.EVENT=2]="EVENT",n[n.ACK=3]="ACK",n[n.CONNECT_ERROR=4]="CONNECT_ERROR",n[n.BINARY_EVENT=5]="BINARY_EVENT",n[n.BINARY_ACK=6]="BINARY_ACK"})(l||(l={}));class Qt{constructor(e){this.replacer=e}encode(e){return(e.type===l.EVENT||e.type===l.ACK)&&Q(e)?this.encodeAsBinary({type:e.type===l.EVENT?l.BINARY_EVENT:l.BINARY_ACK,nsp:e.nsp,data:e.data,id:e.id}):[this.encodeAsString(e)]}encodeAsString(e){let t=""+e.type;return(e.type===l.BINARY_EVENT||e.type===l.BINARY_ACK)&&(t+=e.attachments+"-"),e.nsp&&e.nsp!=="/"&&(t+=e.nsp+","),e.id!=null&&(t+=e.id),e.data!=null&&(t+=JSON.stringify(e.data,this.replacer)),t}encodeAsBinary(e){const t=jt(e),s=this.encodeAsString(t.packet),i=t.buffers;return i.unshift(s),i}}class ge extends m{constructor(e){super(),this.opts=Object.assign({reviver:void 0,maxAttachments:10},typeof e=="function"?{reviver:e}:e)}add(e){let t;if(typeof e=="string"){if(this.reconstructor)throw new Error("got plaintext data when reconstructing a packet");t=this.decodeString(e);const s=t.type===l.BINARY_EVENT;s||t.type===l.BINARY_ACK?(t.type=s?l.EVENT:l.ACK,this.reconstructor=new Gt(t),t.attachments===0&&super.emitReserved("decoded",t)):super.emitReserved("decoded",t)}else if(ue(e)||e.base64)if(this.reconstructor)t=this.reconstructor.takeBinaryData(e),t&&(this.reconstructor=null,super.emitReserved("decoded",t));else throw new Error("got binary data when not reconstructing a packet");else throw new Error("Unknown type: "+e)}decodeString(e){let t=0;const s={type:Number(e.charAt(0))};if(l[s.type]===void 0)throw new Error("unknown packet type "+s.type);if(s.type===l.BINARY_EVENT||s.type===l.BINARY_ACK){const r=t+1;for(;e.charAt(++t)!=="-"&&t!=e.length;);const o=e.substring(r,t);if(o!=Number(o)||e.charAt(t)!=="-")throw new Error("Illegal attachments");const a=Number(o);if(!Zt(a)||a<0)throw new Error("Illegal attachments");if(a>this.opts.maxAttachments)throw new Error("too many attachments");s.attachments=a}if(e.charAt(t+1)==="/"){const r=t+1;for(;++t&&!(e.charAt(t)===","||t===e.length););s.nsp=e.substring(r,t)}else s.nsp="/";const i=e.charAt(t+1);if(i!==""&&Number(i)==i){const r=t+1;for(;++t;){const o=e.charAt(t);if(o==null||Number(o)!=o){--t;break}if(t===e.length)break}s.id=Number(e.substring(r,t+1))}if(e.charAt(++t)){const r=this.tryParse(e.substr(t));if(ge.isPayloadValid(s.type,r))s.data=r;else throw new Error("invalid payload")}return s}tryParse(e){try{return JSON.parse(e,this.opts.reviver)}catch(t){return!1}}static isPayloadValid(e,t){switch(e){case l.CONNECT:return Me(t);case l.DISCONNECT:return t===void 0;case l.CONNECT_ERROR:return typeof t=="string"||Me(t);case l.EVENT:case l.BINARY_EVENT:return Array.isArray(t)&&(typeof t[0]=="number"||typeof t[0]=="string"&&Xt.indexOf(t[0])===-1);case l.ACK:case l.BINARY_ACK:return Array.isArray(t)}}destroy(){this.reconstructor&&(this.reconstructor.finishedReconstruction(),this.reconstructor=null)}}class Gt{constructor(e){this.packet=e,this.buffers=[],this.reconPack=e}takeBinaryData(e){if(this.buffers.push(e),this.buffers.length===this.reconPack.attachments){const t=Jt(this.reconPack,this.buffers);return this.finishedReconstruction(),t}return null}finishedReconstruction(){this.reconPack=null,this.buffers=[]}}const Zt=Number.isInteger||function(n){return typeof n=="number"&&isFinite(n)&&Math.floor(n)===n};function Me(n){return Object.prototype.toString.call(n)==="[object Object]"}const en=Object.freeze(Object.defineProperty({__proto__:null,Decoder:ge,Encoder:Qt,get PacketType(){return l}},Symbol.toStringTag,{value:"Module"}));function S(n,e,t){return n.on(e,t),function(){n.off(e,t)}}const tn=Object.freeze({connect:1,connect_error:1,disconnect:1,disconnecting:1,newListener:1,removeListener:1});class Fe extends m{constructor(e,t,s){super(),this.connected=!1,this.recovered=!1,this.receiveBuffer=[],this.sendBuffer=[],this._queue=[],this._queueSeq=0,this.ids=0,this.acks={},this.flags={},this.io=e,this.nsp=t,s&&s.auth&&(this.auth=s.auth),this._opts=Object.assign({},s),this.io._autoConnect&&this.open()}get disconnected(){return!this.connected}subEvents(){if(this.subs)return;const e=this.io;this.subs=[S(e,"open",this.onopen.bind(this)),S(e,"packet",this.onpacket.bind(this)),S(e,"error",this.onerror.bind(this)),S(e,"close",this.onclose.bind(this))]}get active(){return!!this.subs}connect(){return this.connected?this:(this.subEvents(),this.io._reconnecting||this.io.open(),this.io._readyState==="open"&&this.onopen(),this)}open(){return this.connect()}send(...e){return e.unshift("message"),this.emit.apply(this,e),this}emit(e,...t){var s,i,r;if(tn.hasOwnProperty(e))throw new Error('"'+e.toString()+'" is a reserved event name');if(t.unshift(e),this._opts.retries&&!this.flags.fromQueue&&!this.flags.volatile)return this._addToQueue(t),this;const o={type:l.EVENT,data:t};if(o.options={},o.options.compress=this.flags.compress!==!1,typeof t[t.length-1]=="function"){const h=this.ids++,g=t.pop();this._registerAckCallback(h,g),o.id=h}const a=(i=(s=this.io.engine)===null||s===void 0?void 0:s.transport)===null||i===void 0?void 0:i.writable,c=this.connected&&!(!((r=this.io.engine)===null||r===void 0)&&r._hasPingExpired());return this.flags.volatile&&!a||(c?(this.notifyOutgoingListeners(o),this.packet(o)):this.sendBuffer.push(o)),this.flags={},this}_registerAckCallback(e,t){var s;const i=(s=this.flags.timeout)!==null&&s!==void 0?s:this._opts.ackTimeout;if(i===void 0){this.acks[e]=t;return}const r=this.io.setTimeoutFn(()=>{delete this.acks[e];for(let a=0;a<this.sendBuffer.length;a++)this.sendBuffer[a].id===e&&this.sendBuffer.splice(a,1);t.call(this,new Error("operation has timed out"))},i),o=(...a)=>{this.io.clearTimeoutFn(r),t.apply(this,a)};o.withError=!0,this.acks[e]=o}emitWithAck(e,...t){return new Promise((s,i)=>{const r=(o,a)=>o?i(o):s(a);r.withError=!0,t.push(r),this.emit(e,...t)})}_addToQueue(e){let t;typeof e[e.length-1]=="function"&&(t=e.pop());const s={id:this._queueSeq++,tryCount:0,pending:!1,args:e,flags:Object.assign({fromQueue:!0},this.flags)};e.push((i,...r)=>(this._queue[0],i!==null?s.tryCount>this._opts.retries&&(this._queue.shift(),t&&t(i)):(this._queue.shift(),t&&t(null,...r)),s.pending=!1,this._drainQueue())),this._queue.push(s),this._drainQueue()}_drainQueue(e=!1){if(!this.connected||this._queue.length===0)return;const t=this._queue[0];t.pending&&!e||(t.pending=!0,t.tryCount++,this.flags=t.flags,this.emit.apply(this,t.args))}packet(e){e.nsp=this.nsp,this.io._packet(e)}onopen(){typeof this.auth=="function"?this.auth(e=>{this._sendConnectPacket(e)}):this._sendConnectPacket(this.auth)}_sendConnectPacket(e){this.packet({type:l.CONNECT,data:this._pid?Object.assign({pid:this._pid,offset:this._lastOffset},e):e})}onerror(e){this.connected||this.emitReserved("connect_error",e)}onclose(e,t){this.connected=!1,delete this.id,this.emitReserved("disconnect",e,t),this._clearAcks()}_clearAcks(){Object.keys(this.acks).forEach(e=>{if(!this.sendBuffer.some(s=>String(s.id)===e)){const s=this.acks[e];delete this.acks[e],s.withError&&s.call(this,new Error("socket has been disconnected"))}})}onpacket(e){if(e.nsp===this.nsp)switch(e.type){case l.CONNECT:e.data&&e.data.sid?this.onconnect(e.data.sid,e.data.pid):this.emitReserved("connect_error",new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));break;case l.EVENT:case l.BINARY_EVENT:this.onevent(e);break;case l.ACK:case l.BINARY_ACK:this.onack(e);break;case l.DISCONNECT:this.ondisconnect();break;case l.CONNECT_ERROR:this.destroy();const s=new Error(e.data.message);s.data=e.data.data,this.emitReserved("connect_error",s);break}}onevent(e){const t=e.data||[];e.id!=null&&t.push(this.ack(e.id)),this.connected?this.emitEvent(t):this.receiveBuffer.push(Object.freeze(t))}emitEvent(e){if(this._anyListeners&&this._anyListeners.length){const t=this._anyListeners.slice();for(const s of t)s.apply(this,e)}super.emit.apply(this,e),this._pid&&e.length&&typeof e[e.length-1]=="string"&&(this._lastOffset=e[e.length-1])}ack(e){const t=this;let s=!1;return function(...i){s||(s=!0,t.packet({type:l.ACK,id:e,data:i}))}}onack(e){const t=this.acks[e.id];typeof t=="function"&&(delete this.acks[e.id],t.withError&&e.data.unshift(null),t.apply(this,e.data))}onconnect(e,t){this.id=e,this.recovered=t&&this._pid===t,this._pid=t,this.connected=!0,this.emitBuffered(),this._drainQueue(!0),this.emitReserved("connect")}emitBuffered(){this.receiveBuffer.forEach(e=>this.emitEvent(e)),this.receiveBuffer=[],this.sendBuffer.forEach(e=>{this.notifyOutgoingListeners(e),this.packet(e)}),this.sendBuffer=[]}ondisconnect(){this.destroy(),this.onclose("io server disconnect")}destroy(){this.subs&&(this.subs.forEach(e=>e()),this.subs=void 0),this.io._destroy(this)}disconnect(){return this.connected&&this.packet({type:l.DISCONNECT}),this.destroy(),this.connected&&this.onclose("io client disconnect"),this}close(){return this.disconnect()}compress(e){return this.flags.compress=e,this}get volatile(){return this.flags.volatile=!0,this}timeout(e){return this.flags.timeout=e,this}onAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.push(e),this}prependAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.unshift(e),this}offAny(e){if(!this._anyListeners)return this;if(e){const t=this._anyListeners;for(let s=0;s<t.length;s++)if(e===t[s])return t.splice(s,1),this}else this._anyListeners=[];return this}listenersAny(){return this._anyListeners||[]}onAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.push(e),this}prependAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.unshift(e),this}offAnyOutgoing(e){if(!this._anyOutgoingListeners)return this;if(e){const t=this._anyOutgoingListeners;for(let s=0;s<t.length;s++)if(e===t[s])return t.splice(s,1),this}else this._anyOutgoingListeners=[];return this}listenersAnyOutgoing(){return this._anyOutgoingListeners||[]}notifyOutgoingListeners(e){if(this._anyOutgoingListeners&&this._anyOutgoingListeners.length){const t=this._anyOutgoingListeners.slice();for(const s of t)s.apply(this,e.data)}}}function N(n){n=n||{},this.ms=n.min||100,this.max=n.max||1e4,this.factor=n.factor||2,this.jitter=n.jitter>0&&n.jitter<=1?n.jitter:0,this.attempts=0}N.prototype.duration=function(){var n=this.ms*Math.pow(this.factor,this.attempts++);if(this.jitter){var e=Math.random(),t=Math.floor(e*this.jitter*n);n=(Math.floor(e*10)&1)==0?n-t:n+t}return Math.min(n,this.max)|0},N.prototype.reset=function(){this.attempts=0},N.prototype.setMin=function(n){this.ms=n},N.prototype.setMax=function(n){this.max=n},N.prototype.setJitter=function(n){this.jitter=n};class me extends m{constructor(e,t){var s;super(),this.nsps={},this.subs=[],e&&typeof e=="object"&&(t=e,e=void 0),t=t||{},t.path=t.path||"/socket.io",this.opts=t,J(this,t),this.reconnection(t.reconnection!==!1),this.reconnectionAttempts(t.reconnectionAttempts||1/0),this.reconnectionDelay(t.reconnectionDelay||1e3),this.reconnectionDelayMax(t.reconnectionDelayMax||5e3),this.randomizationFactor((s=t.randomizationFactor)!==null&&s!==void 0?s:.5),this.backoff=new N({min:this.reconnectionDelay(),max:this.reconnectionDelayMax(),jitter:this.randomizationFactor()}),this.timeout(t.timeout==null?2e4:t.timeout),this._readyState="closed",this.uri=e;const i=t.parser||en;this.encoder=new i.Encoder,this.decoder=new i.Decoder,this._autoConnect=t.autoConnect!==!1,this._autoConnect&&this.open()}reconnection(e){return arguments.length?(this._reconnection=!!e,e||(this.skipReconnect=!0),this):this._reconnection}reconnectionAttempts(e){return e===void 0?this._reconnectionAttempts:(this._reconnectionAttempts=e,this)}reconnectionDelay(e){var t;return e===void 0?this._reconnectionDelay:(this._reconnectionDelay=e,(t=this.backoff)===null||t===void 0||t.setMin(e),this)}randomizationFactor(e){var t;return e===void 0?this._randomizationFactor:(this._randomizationFactor=e,(t=this.backoff)===null||t===void 0||t.setJitter(e),this)}reconnectionDelayMax(e){var t;return e===void 0?this._reconnectionDelayMax:(this._reconnectionDelayMax=e,(t=this.backoff)===null||t===void 0||t.setMax(e),this)}timeout(e){return arguments.length?(this._timeout=e,this):this._timeout}maybeReconnectOnOpen(){!this._reconnecting&&this._reconnection&&this.backoff.attempts===0&&this.reconnect()}open(e){if(~this._readyState.indexOf("open"))return this;this.engine=new Ht(this.uri,this.opts);const t=this.engine,s=this;this._readyState="opening",this.skipReconnect=!1;const i=S(t,"open",function(){s.onopen(),e&&e()}),r=a=>{this.cleanup(),this._readyState="closed",this.emitReserved("error",a),e?e(a):this.maybeReconnectOnOpen()},o=S(t,"error",r);if(this._timeout!==!1){const a=this._timeout,c=this.setTimeoutFn(()=>{i(),r(new Error("timeout")),t.close()},a);this.opts.autoUnref&&c.unref(),this.subs.push(()=>{this.clearTimeoutFn(c)})}return this.subs.push(i),this.subs.push(o),this}connect(e){return this.open(e)}onopen(){this.cleanup(),this._readyState="open",this.emitReserved("open");const e=this.engine;this.subs.push(S(e,"ping",this.onping.bind(this)),S(e,"data",this.ondata.bind(this)),S(e,"error",this.onerror.bind(this)),S(e,"close",this.onclose.bind(this)),S(this.decoder,"decoded",this.ondecoded.bind(this)))}onping(){this.emitReserved("ping")}ondata(e){try{this.decoder.add(e)}catch(t){this.onclose("parse error",t)}}ondecoded(e){j(()=>{this.emitReserved("packet",e)},this.setTimeoutFn)}onerror(e){this.emitReserved("error",e)}socket(e,t){let s=this.nsps[e];return s?this._autoConnect&&!s.active&&s.connect():(s=new Fe(this,e,t),this.nsps[e]=s),s}_destroy(e){const t=Object.keys(this.nsps);for(const s of t)if(this.nsps[s].active)return;this._close()}_packet(e){const t=this.encoder.encode(e);for(let s=0;s<t.length;s++)this.engine.write(t[s],e.options)}cleanup(){this.subs.forEach(e=>e()),this.subs.length=0,this.decoder.destroy()}_close(){this.skipReconnect=!0,this._reconnecting=!1,this.onclose("forced close")}disconnect(){return this._close()}onclose(e,t){var s;this.cleanup(),(s=this.engine)===null||s===void 0||s.close(),this.backoff.reset(),this._readyState="closed",this.emitReserved("close",e,t),this._reconnection&&!this.skipReconnect&&this.reconnect()}reconnect(){if(this._reconnecting||this.skipReconnect)return this;const e=this;if(this.backoff.attempts>=this._reconnectionAttempts)this.backoff.reset(),this.emitReserved("reconnect_failed"),this._reconnecting=!1;else{const t=this.backoff.duration();this._reconnecting=!0;const s=this.setTimeoutFn(()=>{e.skipReconnect||(this.emitReserved("reconnect_attempt",e.backoff.attempts),!e.skipReconnect&&e.open(i=>{i?(e._reconnecting=!1,e.reconnect(),this.emitReserved("reconnect_error",i)):e.onreconnect()}))},t);this.opts.autoUnref&&s.unref(),this.subs.push(()=>{this.clearTimeoutFn(s)})}}onreconnect(){const e=this.backoff.attempts;this._reconnecting=!1,this.backoff.reset(),this.emitReserved("reconnect",e)}}const D={};function G(n,e){typeof n=="object"&&(e=n,n=void 0),e=e||{};const t=Ut(n,e.path||"/socket.io"),s=t.source,i=t.id,r=t.path,o=D[i]&&r in D[i].nsps,a=e.forceNew||e["force new connection"]||e.multiplex===!1||o;let c;return a?c=new me(s,e):(D[i]||(D[i]=new me(s,e)),c=D[i]),t.query&&!e.query&&(e.query=t.queryKey),c.socket(t.path,e)}Object.assign(G,{Manager:me,Socket:Fe,io:G,connect:G});function nn(n,e,t){const s=n.apiBase||window.location.origin,i=G(s,{path:"/livechat-ws",auth:{siteKey:n.siteKey,visitorId:n.visitorId,sessionId:e},transports:["websocket","polling"],reconnection:!0,reconnectionDelay:600,reconnectionDelayMax:8e3});return i.on("livechat:event",r=>{r.sessionId===e&&t(r)}),i}const sn=`
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

.lc-msg-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.lc-msg-row-visitor .lc-msg-body { align-items: flex-end; }

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

/* ── Email identify ── */
.lc-identify {
  padding: 12px 14px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
  font-size: 13px;
  flex-shrink: 0;
}
.lc-identify-row { display: flex; gap: 6px; margin-top: 6px; }
.lc-identify input { flex: 1; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; outline: none; }
.lc-identify input:focus { border-color: var(--lc-brand); }
.lc-identify button { background: var(--lc-brand); color: #fff; border: 0; border-radius: 6px; padding: 0 12px; font-size: 13px; cursor: pointer; }
.lc-identify-skip { background: transparent !important; color: #9ca3af !important; font-size: 12px !important; padding: 4px 0 0 0 !important; cursor: pointer; border: 0; margin-top: 6px; }

/* ── Pending attachments ── */
.lc-pending { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 12px 0 12px; background: #fff; flex-shrink: 0; }
.lc-chip { display: inline-flex; align-items: center; gap: 6px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 16px; padding: 4px 10px; font-size: 12px; color: #1f2937; max-width: 220px; }
.lc-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lc-chip button { background: transparent; border: 0; padding: 0 0 0 4px; cursor: pointer; color: #6b7280; font-size: 14px; line-height: 1; }
.lc-chip button:hover { color: #1f2937; }

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
.lc-attach-img { display: block; max-width: 220px; max-height: 200px; border-radius: 10px; cursor: zoom-in; }
.lc-attach-file { display: inline-flex; align-items: center; gap: 8px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; padding: 6px 10px; font-size: 12px; color: #1f2937; text-decoration: none; max-width: 240px; }
.lc-attach-file:hover { background: #e5e7eb; }
.lc-attach-file svg { width: 16px; height: 16px; flex-shrink: 0; color: #6b7280; }
.lc-attach-file span:first-of-type { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.lc-attach-file .lc-attach-size { color: #6b7280; flex-shrink: 0; }

/* ── Mobile ── */
@media (max-width: 480px) {
  :host, :host(.lc-position-left) {
    bottom: 16px;
    right: 16px;
    left: auto;
  }
  .lc-panel {
    position: fixed;
    width: 100vw;
    height: 100dvh;
    height: 100vh;
    bottom: 0;
    right: 0;
    left: 0;
    border-radius: 0;
  }
}
`,rn={siteKey:"",botName:"Hi there",botSubtitle:"We typically reply in a few seconds.",welcomeMessage:null,brandColor:"#2563eb",position:"bottom-right"},ze="livechat_messages_cache",He="livechat_session_id",ye="livechat_identify_dismissed",Ue="livechat_send_log",on=30,an=6e4;function cn(n,e=rn){var ne;const t=document.createElement("div");t.id="livechat-widget-root",t.style.cssText="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;",document.body.appendChild(t);const s=t.attachShadow({mode:"open"}),i=(ne=yn(e.brandColor))!=null?ne:"#2563eb",r=je(i,.35),o=je(i,.45);t.style.setProperty("--lc-brand",i),t.style.setProperty("--lc-brand-shadow",r),t.style.setProperty("--lc-brand-shadow-hover",o),e.position==="bottom-left"&&t.classList.add("lc-position-left");const a=document.createElement("style");a.textContent=sn,s.appendChild(a);const c={open:!1,sessionId:fn(),messages:mn(),socket:null,panel:null,askedForEmail:!1,unread:0},f=document.createElement("button");f.className="lc-bubble",f.innerHTML=En(),s.appendChild(f);const h=document.createElement("span");h.className="lc-unread",h.style.display="none",f.appendChild(h),c.messages.length===0&&e.welcomeMessage&&(c.messages.push({id:"welcome",role:"agent",content:e.welcomeMessage,createdAt:new Date().toISOString()}),ee(c.messages));const g=ln(s,n,c,k,e);g.style.display="none",c.panel=g,f.addEventListener("click",()=>{if(c.open=!c.open,c.open){g.classList.remove("lc-panel--closing"),g.style.display="flex",c.unread=0,h.style.display="none";const C=g.querySelector("textarea");C==null||C.focus(),Ke(g)}else g.classList.add("lc-panel--closing"),setTimeout(()=>{c.open||(g.style.display="none"),g.classList.remove("lc-panel--closing")},180)}),c.sessionId&&Ve(n,c,k);function k(){hn(g,c),!c.open&&c.unread>0?(h.textContent=String(Math.min(c.unread,99)),h.style.display="flex"):h.style.display="none"}k()}function ln(n,e,t,s,i){const r=document.createElement("div");r.className="lc-panel",r.innerHTML=`
    <div class="lc-header">
      <div class="lc-header-inner">
        <div class="lc-header-avatar">${Sn()}</div>
        <div class="lc-header-text">
          <div class="lc-header-title">${q(i.botName)}</div>
          <div class="lc-header-sub"><span class="lc-online-dot"></span>${q(i.botSubtitle)}</div>
        </div>
      </div>
      <button class="lc-close" aria-label="Close">${Je()}</button>
    </div>
    <div class="lc-messages-wrap">
      <div class="lc-messages"></div>
      <button class="lc-scroll-btn" type="button" style="display:none;" aria-label="Scroll to latest">${Je()} New messages</button>
    </div>
    <div class="lc-quick-replies" style="display:none;"></div>
    <div class="lc-identify" style="display:none;">
      <div>What's your email? We'll only use it to follow up if needed.</div>
      <div class="lc-identify-row">
        <input type="email" placeholder="you@example.com" />
        <button>Save</button>
      </div>
      <button class="lc-identify-skip">Skip</button>
    </div>
    <div class="lc-pending" style="display:none;"></div>
    <form class="lc-composer" autocomplete="off">
      <input class="lc-hp" name="website" tabindex="-1" autocomplete="off" />
      <input class="lc-file-input" type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" style="display:none;" />
      <button type="button" class="lc-attach-btn" aria-label="Attach file">${_n()}</button>
      <textarea placeholder="Type your message…" rows="1"></textarea>
      <button type="submit" aria-label="Send">${An()}</button>
    </form>
  `,n.appendChild(r),r.querySelector(".lc-close").addEventListener("click",()=>{t.open=!1,r.classList.add("lc-panel--closing"),setTimeout(()=>{t.open||(r.style.display="none"),r.classList.remove("lc-panel--closing")},180)});const a=r.querySelector(".lc-messages"),c=r.querySelector(".lc-scroll-btn");a.addEventListener("scroll",()=>{const d=a.scrollHeight-a.scrollTop-a.clientHeight;c.style.display=d>120?"flex":"none"}),c.addEventListener("click",()=>{a.scrollTop=a.scrollHeight,c.style.display="none"});const f=r.querySelector(".lc-composer"),h=r.querySelector("textarea"),g=r.querySelector(".lc-hp"),k=r.querySelector('.lc-composer button[type="submit"]'),ne=r.querySelector(".lc-attach-btn"),C=r.querySelector(".lc-file-input"),F=r.querySelector(".lc-pending"),z=r.querySelector(".lc-quick-replies"),y=[],Pn=Date.now();let xe=!1;h.addEventListener("keydown",()=>{xe=!0}),h.addEventListener("input",()=>{xe=!0});const et=()=>{var w;const d=t.messages.some(b=>b.role==="visitor"),p=((w=i.welcomeQuickReplies)!=null?w:[]).filter(Boolean);if(d||p.length===0){z.style.display="none",z.innerHTML="";return}z.style.display="flex",z.innerHTML=p.map((b,u)=>`<button data-i="${u}" type="button">${q(b)}</button>`).join(""),z.querySelectorAll("button").forEach(b=>{b.addEventListener("click",()=>{const u=Number(b.dataset.i),E=p[u];E&&(h.value=E,f.requestSubmit())})})};ne.addEventListener("click",()=>C.click()),C.addEventListener("change",async()=>{var w;const d=(w=C.files)==null?void 0:w[0];if(C.value="",!d)return;if(d.size>10*1024*1024){O(t,`File too large: ${d.name} (max 10 MB)`),s();return}if(y.length>=5){O(t,"You can attach up to 5 files per message."),s();return}if(!t.sessionId){O(t,"Send a message first, then attach files."),s();return}const p={id:"pending-"+Date.now(),mimeType:d.type,sizeBytes:d.size,originalFilename:d.name,url:""};y.push(p),I();try{const b=await v(e,t.sessionId,d),u=y.indexOf(p);u>=0&&(y[u]=b),I()}catch(b){const u=y.indexOf(p);u>=0&&y.splice(u,1),O(t,`Upload failed: ${b.message}`),I(),s()}});function I(){if(!y.length){F.style.display="none",F.innerHTML="";return}F.style.display="flex",F.innerHTML=y.map((d,p)=>`<span class="lc-chip"><span>${q(d.originalFilename)}</span><button data-i="${p}" aria-label="Remove">×</button></span>`).join(""),F.querySelectorAll("button").forEach(d=>{d.addEventListener("click",()=>{const p=Number(d.dataset.i);y.splice(p,1),I()})})}let ve=null,tt=!1;const H=d=>{var p;tt!==d&&(tt=d,(p=t.socket)==null||p.emit("livechat:typing",{on:d}))};h.addEventListener("input",()=>{h.style.height="auto",h.style.height=Math.min(120,h.scrollHeight)+"px",h.value.trim()?(H(!0),ve&&clearTimeout(ve),ve=setTimeout(()=>H(!1),1500)):H(!1)}),h.addEventListener("blur",()=>H(!1)),h.addEventListener("keydown",d=>{d.key==="Enter"&&!d.shiftKey&&(d.preventDefault(),f.requestSubmit())}),h.addEventListener("paste",async d=>{var b;const p=(b=d.clipboardData)==null?void 0:b.items;if(!p)return;const w=[];for(const u of p)if(u.kind==="file"&&u.type.startsWith("image/")){const E=u.getAsFile();E&&w.push(E)}if(w.length){if(d.preventDefault(),!t.sessionId){O(t,"Send a message first, then paste images."),s();return}for(const u of w){if(u.size>10*1024*1024){O(t,`Pasted image too large: ${u.name||"image"} (max 10 MB)`),s();continue}if(y.length>=5)break;const E=u.name?u:new File([u],`pasted-${Date.now()}.png`,{type:u.type}),L={id:"pending-"+Math.random().toString(36).slice(2),mimeType:u.type,sizeBytes:u.size,originalFilename:E.name,url:""};y.push(L),I();try{const we=await v(e,t.sessionId,E),V=y.indexOf(L);V>=0&&(y[V]=we),I()}catch(we){const V=y.indexOf(L);V>=0&&y.splice(V,1),O(t,`Upload failed: ${we.message}`),I(),s()}}}}),f.addEventListener("submit",async d=>{var b;if(d.preventDefault(),g.value)return;const p=h.value.trim(),w=y.filter(u=>u.url&&!u.id.startsWith("pending-"));if(!(!p&&!w.length)){if(!pn()){O(t,"Slow down — too many messages in the last minute."),s();return}k.disabled=!0,h.value="",h.style.height="auto",H(!1),un(t,p,w),y.length=0,I(),et(),s(),We(r);try{const u=await at(e,p,w.map(L=>L.id),{hp:g.value||void 0,elapsedMs:Date.now()-Pn,hadInteraction:xe});Z(r),t.sessionId=u.sessionId,gn(u.sessionId);const E=(b=u.agent.id)!=null?b:"";"content"in u.agent&&u.agent.content&&!t.messages.some(L=>L.id===E&&E)&&Ye(t,u.agent.content,E),t.socket||Ve(e,t,s),dn(r,t)}catch(u){Z(r),O(t,"Could not send. Please try again.")}k.disabled=!1,s()}});const U=r.querySelector(".lc-identify"),Dn=U.querySelector("input"),$n=U.querySelectorAll("button")[0],Mn=U.querySelectorAll("button")[1];return $n.addEventListener("click",async()=>{const d=Dn.value.trim();if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d))try{await ct(e,{email:d}),U.style.display="none";try{localStorage.setItem(ye,"saved")}catch(p){}}catch(p){}}),Mn.addEventListener("click",()=>{U.style.display="none";try{localStorage.setItem(ye,"skipped")}catch(d){}}),et(),r}function Ve(n,e,t){!e.sessionId||e.socket||(e.socket=nn(n,e.sessionId,s=>{var r,o;if(s.type==="typing"){const a=e.panel;if(!a)return;s.on?We(a):Z(a);return}if(s.type!=="message"||!s.messageId||s.role==="visitor"||e.messages.some(a=>a.id===s.messageId))return;Ye(e,(r=s.content)!=null?r:"",s.messageId,s.role==="operator",s.attachments);const i=e.panel;i&&Z(i),e.open||(e.unread=((o=e.unread)!=null?o:0)+1),t()}))}function hn(n,e){const t=n.querySelector(".lc-messages");if(t){if(e.messages.length===0){t.innerHTML='<div class="lc-empty">Send us a message — we will get right back to you.</div>';return}t.innerHTML=e.messages.map(s=>{var f;const i=s.content?xn(s.content):"",r=((f=s.attachments)!=null?f:[]).map(bn).join(""),o=r?`<div class="lc-attachments">${r}</div>`:"",a=wn(s.createdAt),c=a?`<div class="lc-msg-time">${a}</div>`:"";return s.role==="system"?`<div class="lc-msg lc-msg-system">${i}</div>`:s.role==="visitor"?`<div class="lc-msg-row lc-msg-row-visitor">
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-visitor">${i}${o}</div>
            ${c}
          </div>
        </div>`:`<div class="lc-msg-row lc-msg-row-agent">
        <div class="lc-msg-avatar">${Tn()}</div>
        <div class="lc-msg-body">
          <div class="lc-msg lc-msg-agent">${i}${o}</div>
          ${c}
        </div>
      </div>`}).join(""),Ke(n)}}function Ke(n){const e=n.querySelector(".lc-messages");e&&(e.scrollTop=e.scrollHeight)}function We(n){const e=n.querySelector(".lc-messages");if(!e||e.querySelector(".lc-typing"))return;const t=document.createElement("div");t.className="lc-typing",t.innerHTML="<span></span><span></span><span></span>",e.appendChild(t),e.scrollTop=e.scrollHeight}function Z(n){n.querySelectorAll(".lc-typing").forEach(e=>e.remove())}function dn(n,e){if(e.askedForEmail)return;try{if(localStorage.getItem(ye))return}catch(s){}if(e.messages.filter(s=>s.role==="agent").length<1)return;e.askedForEmail=!0;const t=n.querySelector(".lc-identify");t&&(t.style.display="block")}function un(n,e,t){n.messages.push({id:"local-"+Date.now(),role:"visitor",content:e,createdAt:new Date().toISOString(),attachments:t}),ee(n.messages)}function Ye(n,e,t,s=!1,i){n.messages.push({id:t||"srv-"+Date.now(),role:s?"operator":"agent",content:e,createdAt:new Date().toISOString(),attachments:i}),ee(n.messages)}function O(n,e){n.messages.push({id:"sys-"+Date.now(),role:"system",content:e,createdAt:new Date().toISOString()}),ee(n.messages)}function pn(){var n;try{const e=Date.now(),t=JSON.parse((n=localStorage.getItem(Ue))!=null?n:"[]").filter(s=>e-s<an);return t.length>=on?!1:(t.push(e),localStorage.setItem(Ue,JSON.stringify(t)),!0)}catch(e){return!0}}function fn(){try{return localStorage.getItem(He)}catch(n){return null}}function gn(n){try{localStorage.setItem(He,n)}catch(e){}}function mn(){try{const n=localStorage.getItem(ze);return n?JSON.parse(n):[]}catch(n){return[]}}function ee(n){try{localStorage.setItem(ze,JSON.stringify(n.slice(-50)))}catch(e){}}function q(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function yn(n){if(!n)return null;const e=n.trim();return/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(e)?e:null}function je(n,e){let t=n.replace("#","");t.length===3&&(t=t.split("").map(o=>o+o).join(""));const s=parseInt(t.slice(0,2),16),i=parseInt(t.slice(2,4),16),r=parseInt(t.slice(4,6),16);return`rgba(${s}, ${i}, ${r}, ${e})`}function bn(n){if(n.mimeType.startsWith("image/")&&n.url)return`<a href="${$(n.url)}" target="_blank" rel="noopener noreferrer"><img class="lc-attach-img" src="${$(n.url)}" alt="${$(n.originalFilename)}" /></a>`;const t=vn(n.sizeBytes);return`<a class="lc-attach-file" href="${n.url?$(n.url):"#"}" target="_blank" rel="noopener noreferrer">${kn()}<span>${q(n.originalFilename)}</span><span class="lc-attach-size">${t}</span></a>`}function xn(n){return q(n).replace(/(https?:\/\/[^\s<]+)/g,t=>{const s=t.match(/[.,;:!?)]+$/),i=s?s[0]:"",r=i?t.slice(0,-i.length):t;return`<a href="${$(r)}" target="_blank" rel="noopener noreferrer nofollow">${r}</a>${i}`})}function $(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function vn(n){return n<1024?`${n} B`:n<1024*1024?`${(n/1024).toFixed(0)} KB`:`${(n/1024/1024).toFixed(1)} MB`}function wn(n){try{const e=new Date(n);return isNaN(e.getTime())?"":e.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}catch(e){return""}}function _n(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.58 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48"/></svg>'}function kn(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'}function En(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'}function Sn(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'}function Tn(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'}function Je(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'}function An(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'}let Xe="",M=null,te=null;const Bn=3e4;function On(n){Qe(n),Cn(n),window.addEventListener("popstate",()=>be(n)),window.addEventListener("pagehide",()=>{M&&_e(n,M)}),Rn(n)}function Rn(n){const e=()=>{document.visibilityState==="visible"&&ot(n,{url:location.href,title:document.title})};setInterval(e,Bn),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&e()})}function Cn(n){const e={pushState:history.pushState,replaceState:history.replaceState};history.pushState=function(...t){const s=e.pushState.apply(this,t);return be(n),s},history.replaceState=function(...t){const s=e.replaceState.apply(this,t);return be(n),s}}function be(n){te&&clearTimeout(te),te=setTimeout(()=>Qe(n),300)}async function Qe(n){var t;te=null;const e=location.pathname+location.search;if(e!==Xe){Xe=e,M&&_e(n,M);try{M=(t=(await rt(n,{url:location.href,path:location.pathname,title:document.title,referrer:document.referrer,language:navigator.language})).pageviewId)!=null?t:null}catch(s){}}}const Ge="livechat_visitor_id";function In(){const n=Ln();if(!n)return null;const e=n.getAttribute("data-site");if(!e)return null;const t=n.getAttribute("data-api")||Nn(n)||"",s=qn();return{siteKey:e,visitorId:s,apiBase:t}}function Ln(){const n=document.querySelectorAll("script[data-site]");return n.length?n[n.length-1]:null}function Nn(n){if(!n.src)return null;try{const e=new URL(n.src);return`${e.protocol}//${e.host}`}catch(e){return null}}function qn(){try{const n=localStorage.getItem(Ge);if(n)return n;const e=Ze();return localStorage.setItem(Ge,e),e}catch(n){return Ze()}}function Ze(){if(typeof crypto!="undefined"&&crypto.randomUUID)return crypto.randomUUID();let n=Date.now();return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,e=>{const t=(n+Math.random()*16)%16|0;return n=Math.floor(n/16),(e==="x"?t:t&3|8).toString(16)})}(function(){var s;if(typeof window=="undefined"||(s=window.__livechat__)!=null&&s.mounted)return;const e=In();if(!e)return;window.__livechat__={mounted:!0,siteKey:e.siteKey,visitorId:e.visitorId},On(e);const t=async()=>{const i=await B(e);cn(e,i!=null?i:void 0)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",t):t()})()})();
