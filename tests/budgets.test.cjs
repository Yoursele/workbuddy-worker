"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const w=require("../scripts/workbuddy_worker.cjs");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wb-budget-test-"));
process.on("exit",()=>fs.rmSync(dir,{recursive:true,force:true}));
fs.writeFileSync(path.join(dir,"source.txt"),"first\r\nsecond\r\n第三行\r\nfourth");
const spec={cwd:dir,task:"summarize",files:[{path:"source.txt",start_line:2,end_line:3}]};
test("explicit line range includes exactly requested lines",()=>{
 const p=w.prepare(spec);assert.equal(p.inputs[0].text,"second\n第三行");assert.equal(p.inputs[0].name,"source.txt#L2-L3");assert.equal(p.inputs[0].source_sha256.length,64);assert.equal(p.max_output_tokens,1024);
});
for(const range of [[0,1],[3,2],[1,99],[1.5,2]])test("reject invalid closed range "+range,()=>assert.throws(()=>w.prepare({...spec,files:[{path:"source.txt",start_line:range[0],end_line:range[1]}]}),{code:"INVALID_LINE_RANGE"}));
test("range does not bypass path guard",()=>assert.throws(()=>w.prepare({...spec,files:[{path:"../outside.txt",start_line:1,end_line:1}]})));
test("oversized task fails locally instead of truncation",()=>{
 fs.writeFileSync(path.join(dir,"large.txt"),"x".repeat(30000));
 assert.throws(()=>w.prepare({...spec,files:["large.txt"]}),{code:"TASK_NEEDS_SPLIT"});
});
test("small range can select from larger source",()=>{
 fs.writeFileSync(path.join(dir,"source-large.txt"),"x".repeat(300000)+"\nchosen");
 const p=w.prepare({...spec,files:[{path:"source-large.txt",start_line:2,end_line:2}]});assert.equal(p.inputs[0].text,"chosen");
});
test("invalid output budget rejected",()=>{for(const n of [0,63,8193,1.5])assert.throws(()=>w.prepare({...spec,max_output_tokens:n}),{code:"INVALID_OUTPUT_BUDGET"});});
test("output token limit survives model request and tools remain stripped",()=>{
 const p=JSON.parse(w.textOnlyRequest(JSON.stringify({model:"m",messages:[],tools:[{}],max_tokens:128000,max_completion_tokens:128000}),"m","bounded task",1024));
 assert.equal(p.max_tokens,1024);assert.equal(p.max_completion_tokens,undefined);assert.equal(p.tools,undefined);
});
test("check creates no task and makes no model call",async()=>{
 const f=path.join(dir,"task.json");fs.writeFileSync(f,JSON.stringify(spec));const p=await w.main(["check",f]);assert.equal(p.ok,true);assert.equal(p.job_created,false);assert.equal(p.model_call_performed,false);assert.ok(p.input_bytes<=24576);
});

test("explicit provider truncation is not success",()=>{assert.throws(()=>w.safeModelResponse(Buffer.from('{"choices":[{"finish_reason":"length","message":{"content":"partial"}}]}')),{code:"MODEL_OUTPUT_INCOMPLETE"});});
