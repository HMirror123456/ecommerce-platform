import pool from '../db/pool.js';

function mapCategoryRow(row) {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    sortOrder: row.sort_order,
    enabled: !!row.enabled,
    children: [],
  };
}

function buildTree(rows) {
  const nodeMap = new Map();
  const roots = [];

  for (const row of rows) {
    const node = mapCategoryRow(row);
    nodeMap.set(node.id, node);
  }

  for (const node of nodeMap.values()) {
    if (node.parentId == null) {
      roots.push(node);
      continue;
    }
    const parent = nodeMap.get(node.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots.map(stripInternalFields);
}

function stripInternalFields(node) {
  return {
    id: node.id,
    name: node.name,
    children: node.children.map(stripInternalFields),
  };
}

function findNode(categoryId, nodes) {
  for (const node of nodes) {
    if (node.id === categoryId) return node;
    const child = findNode(categoryId, node.children || []);
    if (child) return child;
  }
  return null;
}

function findRoot(categoryId, nodes, root = null) {
  for (const node of nodes) {
    const currentRoot = root || node;
    if (node.id === categoryId) return currentRoot;
    const childRoot = findRoot(categoryId, node.children || [], currentRoot);
    if (childRoot) return childRoot;
  }
  return null;
}

function collectIds(node) {
  return [node.id, ...(node.children || []).flatMap(collectIds)];
}

export async function listTree() {
  const [rows] = await pool.query(
    `SELECT id, parent_id, name, sort_order, enabled
     FROM categories
     WHERE enabled = 1
     ORDER BY parent_id IS NOT NULL, parent_id ASC, sort_order ASC, id ASC`,
  );
  return buildTree(rows);
}

export async function findById(categoryId) {
  const [rows] = await pool.query(
    `SELECT id, parent_id, name, sort_order, enabled
     FROM categories
     WHERE id = ? AND enabled = 1
     LIMIT 1`,
    [categoryId],
  );
  return rows[0] ? mapCategoryRow(rows[0]) : null;
}

export async function getCategoryInfo(categoryId) {
  const tree = await listTree();
  const root = findRoot(Number(categoryId), tree);
  return {
    categoryId,
    categoryName: root?.name || null,
  };
}

export async function getCategoryFilterIds(categoryId) {
  const cid = Number(categoryId);
  if (!Number.isInteger(cid)) return null;
  const tree = await listTree();
  const category = findNode(cid, tree);
  return category ? collectIds(category) : [cid];
}
