# yamlscript

```yaml
- name: YAML Script Introduction
  loop:
    - I'm so excited to explain 'yamlscript' with 'yamlscript'!
    - What is it?
    - yamlscript is written in yaml format and can be compiled into javscript that runs in deno.
    - What can it do?
    - We can use it to manage our dotfiles, workflows like send feed entries to chat room,
      or we can even choose to deploy it to a serverless server such as deno deploy.
  use: console.log
  args: ${index}. ${item}

- name:
    As you see, we use `loop` to define a loop, it can be an literal array, like above,
    you can access the item by using \${item}, the index by using \${index}, just like
    javascript template strings. You will use `use` to call a function, it can be any global
    function from deno. We also have some yamlscript built-in functions, for example,
    we have `rss.entries` function, which can help you to get the fedd entries.
    (you can see all built-in function here
    https://github.com/yamlscript/yamlscript/blob/main/globals/mod.ts )
  use: rss.entries
  args: https://actionsflow.github.io/test-page/hn-rss.xml

- name: '`result` variable will be the last task returned result,
    please note\: `$result` is a variable, but `\${result}` is a string.
    `rss.entries` function will return an array, so we can loop the array like the following.
    You can visit https://requestbin.com/r/enyvb91j5zjv9/23eNPamD4DK4YK1rfEB1FAQOKIj
    to check the request'
  loop: $result
  use: fetch
  args:
    - https://enyvb91j5zjv9.x.pipedream.net/
    - method: POST
      headers:
        Content-Type: application/json
      body: |
        {
          "title": "${item.title.value}",
          "link":  "${item.links[0].href}"
        }

- name:
    How to run this yaml file? Cause yamlscript depended Deno, so we should install
    https://deno.land/#installation first, as you see, we can run a command line tool
    that begins with a colon `:`, then yamlscript will consider it as a cmd call.
    You also noticed that I use `if` with `false` to prevent this task.
  use: :brew install deno
  if: false
- name: Once deno installed in your local enviroment, you can install yamlscript now.
  use: :deno install -A https://deno.land/x/yamlscript/ys.ts
  if: false
- name: Now you can run this file
  use: :ys
  args:
    - run
    - https://raw.githubusercontent.com/yamlscript/yamlscript/main/README.ys.yml
  if: false
- name:
    You can also see the compiled javascript code , the built file will placed
    in `dist` folder, you can submit this folder to git, if you want to run the code
    with serverless service like deno deploy.
  use: :ys build https://raw.githubusercontent.com/yamlscript/yamlscript/main/README.ys.yml
  if: false

- name:
    You have seen we use `if` before, actually, we can use any condition here,
    you should't add $, or \${} in if condition.
  if: Date.now() > 0
  use: setGlobalVars
  args:
    nowIsGreaterThanZero: true
- name:
    We can use assertEquals to test our code, once it failed, it'll throw an error.
    `assertEquals` is a built-in function, you can use it directly.
  use: assertEquals
  args:
    - $nowIsGreaterThanZero
    - true

```

This README.md file is generated by the following yamlscript.

```yaml
- id: readmeYamlContent
  use: readTextFile
  args: ./README.ys.yml
- id: readmeTemplate
  use: readTextFile
  args: ./README.template.md
- id: yamlMakeReadmeScript
  use: readTextFile
  args: ./scripts/make_readme.ys.yml
- id: readmeContent
  from: https://esm.sh/mustache@4.2.0
  use: default.render
  args:
    - $readmeTemplate
    - readmeYamlContent: $readmeYamlContent
      yamlMakeReadmeScript: $yamlMakeReadmeScript
- use: writeTextFile
  args:
    - README.md
    - $readmeContent

```

See all [built-in functions](/globals/mod.ts)

yamlscript is used to compose powerful workflow tools with minimal knowledge,
which is all the attributes of yaml scripts:

```typescript
interface Task {
  id?: string;
  name?: string;
  from?: string;
  use?: string;
  args?: unknown | unknown[];
  loop?: string | number | unknown[];
  if?: boolean | string;
  catch?: boolean;
}
```
