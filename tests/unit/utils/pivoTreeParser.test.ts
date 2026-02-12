import { describe, it, expect } from "vitest";

interface TreeNode {
  name: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

function parsePivoStructure(obj: any, name: string = "root"): TreeNode {
  const children: TreeNode[] = [];
  for (const key in obj) {
    if (obj[key] === "file") {
      children.push({ name: key, type: "file" });
    } else {
      children.push(parsePivoStructure(obj[key], key));
    }
  }
  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { name, type: "directory", children };
}

describe("PIVO Tree Parser", () => {
  it("should correctly transform nested object to tree nodes", () => {
    const mockStructure = {
      "src": {
        "App.tsx": "file",
        "components": {
          "Header.tsx": "file"
        }
      },
      "package.json": "file"
    };

    const tree = parsePivoStructure(mockStructure);
    
    expect(tree.name).toBe("root");
    expect(tree.children?.length).toBe(2);
    expect(tree.children?.[0].name).toBe("src");
    expect(tree.children?.[0].children?.[0].name).toBe("components");
    expect(tree.children?.[1].name).toBe("package.json");
  });
});
