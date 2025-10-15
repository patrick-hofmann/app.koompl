/**
 * Simple storage utility for feature modules
 */

export interface StorageData {
  [key: string]: any
}

export function createStorage<T extends StorageData>(
  storageKey: string,
  teamId: string,
  initialData: T
) {
  const storage = useStorage(storageKey)
  const key = `teams/${teamId}/data.json`

  return {
    async read(): Promise<T> {
      const data = await storage.getItem<T>(key)
      return data || initialData
    },

    async write(data: T): Promise<void> {
      await storage.setItem(key, data)
    },

    async update(updates: Partial<T>): Promise<T> {
      const current = await this.read()
      const updated = { ...current, ...updates }
      await this.write(updated)
      return updated
    }
  }
}
