import { generateUUID } from "../useTaskHistory"

describe("generateUUID", () => {
	const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

	it("should return a valid UUID string", () => {
		const uuid = generateUUID()
		expect(uuid).toMatch(UUID_REGEX)
	})

	it("should return unique values on successive calls", () => {
		const uuid1 = generateUUID()
		const uuid2 = generateUUID()
		const uuid3 = generateUUID()
		expect(new Set([uuid1, uuid2, uuid3]).size).toBe(3)
	})

	it("should use crypto.randomUUID when available", () => {
		const mockRandomUUID = vi.fn().mockReturnValue("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")
		const originalCrypto = globalThis.crypto
		Object.defineProperty(globalThis, "crypto", {
			value: { randomUUID: mockRandomUUID },
			writable: true,
			configurable: true,
		})

		const uuid = generateUUID()
		expect(uuid).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")
		expect(mockRandomUUID).toHaveBeenCalledTimes(1)

		Object.defineProperty(globalThis, "crypto", {
			value: originalCrypto,
			writable: true,
			configurable: true,
		})
	})

	it("should fallback when crypto.randomUUID is not available", () => {
		const originalCrypto = globalThis.crypto
		Object.defineProperty(globalThis, "crypto", {
			value: {},
			writable: true,
			configurable: true,
		})

		const uuid = generateUUID()
		expect(uuid).toMatch(UUID_REGEX)

		Object.defineProperty(globalThis, "crypto", {
			value: originalCrypto,
			writable: true,
			configurable: true,
		})
	})

	it("should fallback when crypto is undefined", () => {
		const originalCrypto = globalThis.crypto
		Object.defineProperty(globalThis, "crypto", {
			value: undefined,
			writable: true,
			configurable: true,
		})

		const uuid = generateUUID()
		expect(uuid).toMatch(UUID_REGEX)

		Object.defineProperty(globalThis, "crypto", {
			value: originalCrypto,
			writable: true,
			configurable: true,
		})
	})
})
