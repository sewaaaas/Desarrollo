import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root='C:/Users/Sewas/proyecto/caja_ica_diseno';
const runtime='C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt/dependencies';
process.env.RUNTIME_NODE_MODULES=runtime+'/node/node_modules';
const req=createRequire(runtime+'/node/node_modules/__runtime__.cjs');
const {Presentation,PresentationFile}=await import(pathToFileURL(req.resolve('@oai/artifact-tool')).href);
const skill='C:/Users/Sewas/.codex/plugins/cache/openai-primary-runtime/presentations/26.1119.11507/skills/presentations';
const {finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs').href);
const p=Presentation.load(JSON.parse(await fs.readFile(root+'/final-state.json','utf8')));
await fs.mkdir(root+'/output',{recursive:true});
await (await PresentationFile.exportPptx(p)).save(root+'/candidate.pptx');
const result=await finalizePresentation({workspaceDir:root,candidatePath:root+'/candidate.pptx',finalPath:root+'/output/Caja_Ica_Diseno_Universitario.pptx',pythonExecutable:runtime+'/python/python.exe',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit','--require-native-table-slide','4'],materializeLiteralChartWorkbooks:true,explicitTotalSlideCount:5,requiredNativeTableOwnerSlides:[4],requiredNativeChartOwnerSlides:[4],fontPolicy:{basis:'design',families:['Aptos']},verifyArtifactToolImport:true,receiptPath:root+'/validation.json'});
console.log(JSON.stringify(result));

