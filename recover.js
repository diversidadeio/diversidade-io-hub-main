const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function recover() {
  const transcriptPath = path.join(
    'C:', 'Users', 'tecno', '.gemini', 'antigravity', 'brain',
    '29681ca9-f83a-485f-8a55-89db5c8d4859', '.system_generated', 'logs', 'transcript_full.jsonl'
  );

  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Reading transcript...");
  
  let toolCalls = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const step = JSON.parse(line);
      if (step.source === 'MODEL' && step.type === 'PLANNER_RESPONSE' && step.tool_calls) {
        for (const tc of step.tool_calls) {
          if (tc.name === 'replace_file_content' || 
              tc.name === 'multi_replace_file_content' || 
              tc.name === 'write_to_file' ||
              tc.name === 'run_command') {
            toolCalls.push(tc);
          }
        }
      }
    } catch (e) {
      console.error("Error parsing line", e);
    }
  }

  console.log(`Found ${toolCalls.length} modifying tool calls. Generating recovery script...`);

  let recoveryScript = `const fs = require('fs');\nconst path = require('path');\n\n`;
  recoveryScript += `console.log("Starting recovery...");\n\n`;

  // We only want to recover the files we know we touched recently and lost.
  // The git status showed these files were modified before we did git checkout:
  // 	01_painel_adm_migrations.sql
  // 	client/src/contexts/AuthContext.tsx
  // 	client/src/pages/CadastroGratuito.tsx
  // 	client/src/pages/Login.tsx
  // 	client/src/pages/MeuCadastro.tsx
  // 	package.json
  // 	pnpm-lock.yaml
  // 	server/index.ts
  // 	vite.config.ts
  // 	02_recuperacao_senha.sql
  // 	server/api.ts

  // We will re-apply ALL file modifications sequentially.
  
  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    const args = tc.args || {};
    
    // Convert stringified JSON args back to objects if they are strings
    let parsedArgs = {};
    for (const [k, v] of Object.entries(args)) {
        try {
            parsedArgs[k] = (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) ? JSON.parse(v) : v;
        } catch(e) {
            parsedArgs[k] = v;
        }
    }

    if (tc.name === 'replace_file_content') {
        let file = parsedArgs.TargetFile;
        if (!file) continue;
        recoveryScript += `// Step ${i}: replace_file_content on ${file}\n`;
        recoveryScript += `try {
  let content = fs.readFileSync(${JSON.stringify(file)}, 'utf8');
  let target = ${JSON.stringify(parsedArgs.TargetContent)};
  let replacement = ${JSON.stringify(parsedArgs.ReplacementContent)};
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(${JSON.stringify(file)}, content);
    console.log("Applied replace on " + ${JSON.stringify(file)});
  } else {
    console.log("Target not found in " + ${JSON.stringify(file)});
  }
} catch(e) { console.error(e.message); }\n\n`;
    }
    
    if (tc.name === 'multi_replace_file_content') {
        let file = parsedArgs.TargetFile;
        if (!file) continue;
        let chunks = parsedArgs.ReplacementChunks || [];
        recoveryScript += `// Step ${i}: multi_replace_file_content on ${file}\n`;
        recoveryScript += `try {
  let content = fs.readFileSync(${JSON.stringify(file)}, 'utf8');
  let chunks = ${JSON.stringify(chunks)};
  let modified = false;
  for (let chunk of chunks) {
    if (content.includes(chunk.TargetContent)) {
      content = content.replace(chunk.TargetContent, chunk.ReplacementContent);
      modified = true;
    }
  }
  if (modified) {
    fs.writeFileSync(${JSON.stringify(file)}, content);
    console.log("Applied multi_replace on " + ${JSON.stringify(file)});
  }
} catch(e) { console.error(e.message); }\n\n`;
    }

    if (tc.name === 'write_to_file') {
        let file = parsedArgs.TargetFile;
        if (!file) continue;
        recoveryScript += `// Step ${i}: write_to_file on ${file}\n`;
        recoveryScript += `try {
  fs.writeFileSync(${JSON.stringify(file)}, ${JSON.stringify(parsedArgs.CodeContent)});
  console.log("Applied write to " + ${JSON.stringify(file)});
} catch(e) { console.error(e.message); }\n\n`;
    }
  }

  fs.writeFileSync('do_recover.js', recoveryScript);
  console.log("Created do_recover.js. Run 'node do_recover.js' to apply.");
}

recover();
