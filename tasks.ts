import {
  BuildContext,
  BuildTasksOptions,
  PublicContext,
  RunTasksOptions,
  Task,
  TasksOptions,
} from "./interface.ts";
import {
  BuiltCode,
  FileCode,
  GetDefaultTaskOptionsOptions,
  LiteralCode,
  StrictLiteralCode,
  StrictTask,
  StrictTasksOptions,
  TasksCode,
  UseType,
} from "./_interface.ts";

import {
  compile,
  convertValueToLiteral,
  getCommandProgram,
  isCommand,
} from "./template.ts";
import * as globals from "./globals/mod.ts";
import {
  createDistFile,
  get,
  getDefaultPublicContext,
  isObject,
} from "./util.ts";
import {
  COMPILED_CONTEXT_KEYS,
  DEFAULT_USE_NAME,
  GLOBAL_PACKAGE_URL,
  LOOP_ITEM_INDEX,
  LOOP_ITEM_NAME,
  LOOP_LENGTH_NAME,
  LOOP_VARIABLE_NAME,
  RUNTIME_FUNCTION_OPTIONS_NAME,
} from "./constant.ts";
import log from "./log.ts";
import { green } from "./deps.ts";
import config from "./config.json" assert { type: "json" };
const contextConfig = config.context;
export function compileTasks(
  tasks: Task[],
  originalOptions: TasksOptions,
): TasksCode {
  log.debug("run single options", JSON.stringify(originalOptions, null, 2));
  const options = getDefaultTasksOptions(originalOptions);
  // for precompiled code to import modules
  const fileCode = initFileCode();
  const mainIndent = options.indent + 2;
  // one by one
  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
    const originalTask = tasks[taskIndex];
    const task = getDefaultTaskOptions(originalTask, {
      taskIndex,
    });
    const { loop: rawLoop } = task;

    // first transform top level from and use code
    const importResult = transformImport(task, options);
    concatFileCode(fileCode, importResult);
    // change use to final value
    task.use = importResult.use as string;
    task.from = importResult.from as string;
    // transform main function body

    // check if loop
    if (rawLoop) {
      const loopResult = transformLoop(task, {
        ...options,
        indent: mainIndent,
      });
      concatFileCode(fileCode, loopResult);
    } else {
      const useCallResult = transformUseCall(task, {
        ...options,
        indent: mainIndent,
      });
      concatFileCode(fileCode, useCallResult);
    }
  }
  return getTasksCode(fileCode);
}

export function buildTasks(
  tasks: Task[],
  options: BuildTasksOptions,
): Promise<BuiltCode> {
  const codeResult = compileTasks(tasks, options);
  return createDistFile(codeResult.moduleFileCode, options);
}
export function runTasks(tasks: Task[], options: RunTasksOptions) {
  const codeResult = compileTasks(tasks, options);
  return runAsyncFunction(codeResult.runtimeCode);
}
export function runAsyncFunction(runtimeCode: string) {
  // run
  const AsyncFunction = Object.getPrototypeOf(
    async function () {},
  ).constructor;

  const runtimeFn = new AsyncFunction(
    RUNTIME_FUNCTION_OPTIONS_NAME,
    runtimeCode,
  );
  return runtimeFn({
    globals: globals,
  }).catch((e: Error) => {
    log.debug("runtimeCode", runtimeCode);
    log.fatal(e.message);
  });
}

function getTasksCode(fileCode: FileCode): TasksCode {
  const runtimeCode =
    `${fileCode.runtimeImportCode}\n${fileCode.mainFunctionBody}`;

  const compiledModuleCode = fileCode.importCode +
    `export default async function main(){\n${fileCode.mainFunctionBody}}`;
  return {
    moduleFileCode: compiledModuleCode,
    runtimeCode,
  };
}

// affect function
function concatFileCode(fileCode: FileCode, literalCode: LiteralCode): void {
  const strickLiteralCode = formatLiteralCode(literalCode);
  fileCode.importCode += strickLiteralCode.importCode;
  fileCode.runtimeImportCode += strickLiteralCode.runtimeImportCode;
  fileCode.mainFunctionBody += strickLiteralCode.mainFunctionBody;
}

function initFileCode(): FileCode {
  const importCode = "";
  // for runtime code to import modules
  const runtimeImportCode = "";
  const mainFunctionBody =
    `  let ${contextConfig.lastTaskResultName}=null, ${contextConfig.rootName}=null, ${contextConfig.envName}=null;\n`;
  return {
    importCode,
    runtimeImportCode,
    mainFunctionBody,
  };
}

function transformLoop(
  task: StrictTask,
  options: StrictTasksOptions,
): LiteralCode {
  const { loop: rawLoop } = task;
  let mainFunctionBody = "";
  const mainIndent = options.indent;
  console.log("mainIndent loop", mainIndent);
  // start build function body
  if (rawLoop && typeof rawLoop === "string" && rawLoop.trim()) {
    // consider as direct literal code
    const arrayLiberal = convertValueToLiteral(rawLoop, options.public);
    mainFunctionBody +=
      `for(let index = 0; index < ${arrayLiberal}.length; index++){
  const item = ${arrayLiberal}[index];\n`;
    // transform use call
    const useCallResult = transformUseCall(task, {
      ...options,
      indent: options.indent,
    });
    mainFunctionBody += useCallResult.mainFunctionBody;
    mainFunctionBody += `}\n`;
  } else if (rawLoop && Array.isArray(rawLoop)) {
    // loop array
    // compiled loop
    for (let i = 0; i < rawLoop.length; i++) {
      mainFunctionBody += `{
  const item = ${convertValueToLiteral(rawLoop[i], options.public)};
  const index = ${i};\n`;
      // transform useCall
      const useCallResult = transformUseCall(task, {
        ...options,
        indent: options.indent,
      });
      mainFunctionBody += useCallResult.mainFunctionBody;

      mainFunctionBody += `}\n`;
    }
  } else {
    throw new Error("invalid loop params");
  }

  mainFunctionBody = withIndent(mainFunctionBody, mainIndent);
  return {
    mainFunctionBody,
  };
}

function transformUseCall(
  task: StrictTask,
  options: StrictTasksOptions,
): LiteralCode {
  let mainFunctionBody = "";
  const { args, use } = task;
  const { indent } = options;
  // check if it's setVars
  // if it's setVars
  if (use === "setVars") {
    if (args && args.length === 1 && isObject(args[0])) {
      if (!Array.isArray(args[0])) {
        const keys = Object.keys(args[0] as Record<string, unknown>);
        for (const key of keys) {
          mainFunctionBody += `const ${key}=${
            convertValueToLiteral(
              (args[0] as Record<string, unknown>)[key],
              options.public,
            )
          };\n`;
        }
      } else {
        throw new Error("invalid args, setVars args must be object");
      }
    } else {
      // invalid setVars
      throw new Error("invalid args, setVars args must be object");
    }
  } else {
    // check if use is command
    if (isCommand(use)) {
      mainFunctionBody += transformCommandCall(task, options).mainFunctionBody;
    } else {
      // consider as function
      // array, then put args to literal args
      // constructor.name
      const argsFlatten = args.map((
        arg,
      ) => (convertValueToLiteral(arg, options.public)))
        .join(",");

      mainFunctionBody +=
        `${contextConfig.lastTaskResultName} = await ${use}(${argsFlatten});\n`;
    }
  }
  mainFunctionBody = withIndent(mainFunctionBody, indent);
  return {
    mainFunctionBody,
  };
}

/**
 * parse from and use
 * @param raw
 */
function transformImport(
  task: StrictTask,
  options: StrictTasksOptions,
): LiteralCode {
  const { from: rawFrom, use: rawUse } = task;
  let importCode = "";
  let runtimeImportCode = "";
  let use = DEFAULT_USE_NAME;
  if (rawUse && rawUse.trim() !== "") {
    const useTemplateFn = compile(rawUse, COMPILED_CONTEXT_KEYS);
    use = useTemplateFn(options.public);
  }

  if (use === "setVars") {
    // no more import
    return { use: use, useType: UseType.SetVars };
  } else if (isCommand(use)) {
    // no more import
    // cmd
    return { use: use, useType: UseType.Command };
  }

  let debugLog = ``;
  let from: string | undefined;
  if (rawFrom && rawFrom.trim() !== "") {
    const fromTemplateFn = compile(rawFrom, COMPILED_CONTEXT_KEYS);
    from = fromTemplateFn(options.public);
  }
  // add compile code
  if (from) {
    let importPath = "";
    if (DEFAULT_USE_NAME === use) {
      // default
      // use if empty, we will give it a default random name
      importPath = DEFAULT_USE_NAME + "_" + task.taskIndex;
      use = importPath;
    } else {
      importPath = getImportPathValue(use);
    }
    importCode += `import ${importPath} from "${from}";\n`;
    runtimeImportCode += `const ${importPath} = await import("${from}");\n`;

    // try to get the function type
    // TODO: get the function type

    debugLog += `use ${green(importPath)} from {${from}}`;
  } else if (get(globals, use)) {
    //
    const importPath = getImportPathValue(use);

    importCode += `import ${importPath} from "${GLOBAL_PACKAGE_URL}";\n`;
    runtimeImportCode +=
      `const ${importPath} = ${RUNTIME_FUNCTION_OPTIONS_NAME}.globals;\n`;
    debugLog += `use { ${green(use)} } from "globals/mod.ts"`;
  } else if (
    get(globalThis, use) &&
    typeof get(globalThis, use) === "function"
  ) {
    debugLog += `use ${green(use)}`;
  } else {
    // not found use
    log.fatal(
      `can't found function ${green(use)}, did you forget \`${
        green(
          "from",
        )
      }\` param?`,
    );
  }
  return {
    use: use,
    from,
    importCode,
    runtimeImportCode,
    debugLog,
  };
}

function formatLiteralCode(result: LiteralCode): StrictLiteralCode {
  return {
    useType: result.useType ?? UseType.Default,
    use: result.use ?? "",
    from: result.from ?? "",
    mainFunctionBody: result.mainFunctionBody ?? "",
    debugLog: result.debugLog ?? "",
    infoLog: result.infoLog ?? "",
    importCode: result.importCode ?? "",
    runtimeImportCode: result.runtimeImportCode ?? "",
    functions: result.functions ?? [],
    subTasks: result.subTasks ?? [],
  };
}

function getDefaultTasksOptions(
  tasksOptions: TasksOptions,
): StrictTasksOptions {
  return {
    ...tasksOptions,
    public: tasksOptions.public ?? getDefaultPublicContext(),
    indent: tasksOptions.indent ?? 0,
  };
}
function getDefaultTaskOptions(
  task: Task,
  options: GetDefaultTaskOptionsOptions,
): StrictTask {
  const { args: rawArgs } = task;
  let argsArray: unknown[] = [];
  if (rawArgs && !Array.isArray(rawArgs)) {
    argsArray = [rawArgs];
  } else if (Array.isArray(rawArgs)) {
    argsArray = rawArgs;
  }
  return {
    ...task,
    args: argsArray,
    taskIndex: options.taskIndex,
  };
}

function withIndent(code: string, indent: number): string {
  return code.split("\n").map((line) => {
    // if line is only \n
    if (line.trim() === "") {
      return line;
    } else {
      return `${" ".repeat(indent)}${line}`;
    }
  }).join(
    "\n",
  );
}

function getImportPathValue(use: string): string {
  let importPath = `{ ${use} }`;
  const useDotIndex = use.indexOf(".");
  // test if use include ., like rss.entries, _.get
  if (useDotIndex > 0) {
    importPath = `{ ${use.slice(0, useDotIndex)} }`;
  }
  return importPath;
}

function transformCommandCall(
  task: StrictTask,
  options: StrictTasksOptions,
): LiteralCode {
  let cmdArrayString = `"${getCommandProgram(task.use)}"`;
  const { args } = task;

  if (args.length > 0) {
    cmdArrayString += ",";
    cmdArrayString += args.map((
      arg,
    ) => (convertValueToLiteral(arg, options.public)))
      .join(",");
  }

  const mainFunctionBody = `const p = Deno.run({
  cmd: [${cmdArrayString}],
  stdout: "piped",
  stderr: "piped",
});

const { code } = await p.status();

// Reading the outputs closes their pipes
const rawOutput = await p.output();
const rawError = await p.stderrOutput();

if (code === 0) {
  await Deno.stdout.write(rawOutput);
} else {
  const errorString = new TextDecoder().decode(rawError);
  console.log(errorString);
}
Deno.exit(code);
`;
  return { mainFunctionBody };
}