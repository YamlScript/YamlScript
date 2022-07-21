import { buildTasks, runTasks } from "./tasks.ts";
import { BuildContext, Task } from "./interface.ts";
import { assertEquals } from "./deps.ts";
import { parseYamlFile } from "./util.ts";
const buildContext: BuildContext = {
  env: {},
  os: {},
};
const cacheDist = ".ys/__fixtures__";
Deno.test("compileTasks tasks #1", async () => {
  const result = await buildTasks([
    {
      use: "console.log",
      args: [
        "hello",
        "${env.name}",
      ],
    },
  ], {
    dist: cacheDist,
    relativePath: "./tast1.yml",
  });
  const expected = await Deno.readTextFile(
    "./examples/__fixtures__/tast1.mod.js",
  );
  assertEquals(result.moduleFileCode, expected);
});
Deno.test("compileTasks tasks loop #2", async () => {
  const result = await buildTasks([
    {
      loop: [
        1,
        "secondItem",
      ],
      use: "console.log",
      args: [
        "hello",
        "${item}",
        "${index}",
        "${index+1}1234567",
      ],
    },
  ], {
    dist: cacheDist,
    relativePath: "./tast2.yml",
  });
  const expected = await Deno.readTextFile(
    "./examples/__fixtures__/tast2.mod.js",
  );
  assertEquals(result.moduleFileCode, expected);
});
Deno.test("compileTasks tasks #3", async () => {
  const result = await buildTasks([
    {
      from: "https://deno.land/std@0.148.0/path/mod.ts",
      use: "extname",
      args: "test.ys.yml",
    },
    {
      use: "console.log",
      args: ["${result}"],
    },
  ], {
    dist: cacheDist,
    relativePath: "./tast3.yml",
  });
  const expected = await Deno.readTextFile(
    "./examples/__fixtures__/tast3.mod.js",
  );
  assertEquals(result.moduleFileCode, expected);
});
Deno.test("compileTasks full tasks #4", async () => {
  const tasks = await parseYamlFile(
    "./examples/full.ys.yml",
  ) as Task[];
  const result = await buildTasks(tasks, {
    dist: cacheDist,
    relativePath: "./full.ys.yml",
  });
  // const expected = await Deno.readTextFile("./__fixtures__/tast3.mod.js");
  // assertEquals(result.moduleFileCode, expected);
});
Deno.test("test if condition #5", async () => {
  const tasks = await parseYamlFile(
    "./examples/if.ys.yml",
  ) as Task[];
  await runTasks(tasks);
});

Deno.test("compileTasks tasks #6", async () => {
  const result = await buildTasks([
    {
      use: ":echo",
      args: [
        "hello",
        "world",
      ],
    },
  ], {
    dist: cacheDist,
    relativePath: "./tast6.yml",
  });
  // TODO
  // const expected = await Deno.readTextFile(
  //   "./examples/__fixtures__/tast6.mod.js",
  // );
  // assertEquals(result.moduleFileCode, expected);
});
