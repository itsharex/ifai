
import React, { useState } from "react";
import { Folder, File, ChevronRight, ChevronDown, Star } from "lucide-react";

interface TreeNode {
  name: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

interface ProjectTreeProps {
  structure: any;
  keyFiles?: Record<string, string>;
}

const TreeItem: React.FC<{ node: TreeNode; level: number; keyFilesPaths: string[] }> = ({ node, level, keyFilesPaths }) => {
  const [isOpen, setIsOpen] = useState(level < 1); // 默认展开第一层
  const hasChildren = node.children && node.children.length > 0;
  const isKeyFile = keyFilesPaths.some(p => p.endsWith(node.name));

  return (
    <div className="select-none">
      <div 
        className={`flex items-center py-1 px-2 hover:bg-white/5 rounded cursor-pointer transition-colors ${isKeyFile ? "text-blue-400" : "text-gray-300"}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="w-4 h-4 mr-1 flex items-center justify-center">
          {hasChildren ? (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : null}
        </span>
        <span className="mr-2">
          {node.type === "directory" ? (
            <Folder size={16} className="text-amber-400/80" />
          ) : (
            <File size={16} className="text-gray-400" />
          )}
        </span>
        <span className="text-sm font-medium truncate">{node.name}</span>
        {isKeyFile && <Star size={12} className="ml-2 text-yellow-500 fill-yellow-500/20" />}
      </div>
      
      {hasChildren && isOpen && (
        <div className="border-l border-white/10 ml-[18px]">
          {node.children!.map((child, i) => (
            <TreeItem key={i} node={child} level={level + 1} keyFilesPaths={keyFilesPaths} />
          ))}
        </div>
      )}
    </div>
  );
};

export const PivoProjectTree: React.FC<ProjectTreeProps> = ({ structure, keyFiles = {} }) => {
  const parseStructure = (obj: any, name: string = "root"): TreeNode => {
    const children: TreeNode[] = [];
    for (const key in obj) {
      if (obj[key] === "file") {
        children.push({ name: key, type: "file" });
      } else {
        children.push(parseStructure(obj[key], key));
      }
    }
    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return { name, type: "directory", children };
  };

  const treeData = parseStructure(structure);
  const keyFilesPaths = Object.keys(keyFiles);

  return (
    <div className="bg-[#1e1e1e]/50 border border-white/10 rounded-lg p-2 my-2 font-mono max-h-[400px] overflow-y-auto custom-scrollbar">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 px-2 flex justify-between">
        <span>Project Topology</span>
        <span>{keyFilesPaths.length} key files identified</span>
      </div>
      {treeData.children?.map((node, i) => (
        <TreeItem key={i} node={node} level={0} keyFilesPaths={keyFilesPaths} />
      ))}
    </div>
  );
};
