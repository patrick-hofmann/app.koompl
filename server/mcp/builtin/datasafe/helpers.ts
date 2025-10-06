import type { DatasafeFolderNode } from '../../../types/datasafe'

export interface FlattenedFile {
  path: string
  size: number
  updatedAt: string
  source: string
}

export interface FolderAggregate {
  path: string
  name: string
  fileCount: number
  totalSize: number
  latestUpdatedAt?: string
}

export function flattenFiles(
  folder: DatasafeFolderNode,
  acc: FlattenedFile[] = []
): FlattenedFile[] {
  for (const child of folder.children) {
    if (child.type === 'file') {
      acc.push({
        path: child.path,
        size: child.size,
        updatedAt: child.updatedAt,
        source: child.source
      })
    } else {
      flattenFiles(child, acc)
    }
  }
  return acc
}

export function aggregateFolderStats(
  folder: DatasafeFolderNode,
  acc: FolderAggregate[]
): FolderAggregate {
  let fileCount = 0
  let totalSize = 0
  let latestUpdatedAt: string | undefined

  for (const child of folder.children) {
    if (child.type === 'file') {
      fileCount += 1
      totalSize += child.size
      if (
        !latestUpdatedAt ||
        new Date(child.updatedAt).getTime() > new Date(latestUpdatedAt).getTime()
      ) {
        latestUpdatedAt = child.updatedAt
      }
    } else {
      const childAggregate = aggregateFolderStats(child, acc)
      fileCount += childAggregate.fileCount
      totalSize += childAggregate.totalSize
      if (
        childAggregate.latestUpdatedAt &&
        (!latestUpdatedAt ||
          new Date(childAggregate.latestUpdatedAt).getTime() > new Date(latestUpdatedAt).getTime())
      ) {
        latestUpdatedAt = childAggregate.latestUpdatedAt
      }
    }
  }

  const aggregate: FolderAggregate = {
    path: folder.path || '/',
    name: folder.name,
    fileCount,
    totalSize,
    latestUpdatedAt
  }

  acc.push(aggregate)
  return aggregate
}

export function countFolders(folder: DatasafeFolderNode): number {
  let count = 1
  for (const child of folder.children) {
    if (child.type === 'folder') {
      count += countFolders(child)
    }
  }
  return count
}
