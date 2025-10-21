import { useMemo } from 'react'

/**
 * 각 열의 합계를 계산해 마지막에 붙인 2D 배열 반환
 * @param data (string | number)[][] - 원본 데이터
 * @returns (string | number)[][] - 합계 행이 추가된 새 배열
 */
function useSumRow(data: (string | number)[][]): (string | number)[][] {
  return useMemo(() => {
    if (data.length === 0) return data
    // 최대 열 개수 구하기
    const cols = Math.max(...data.map((row) => row.length))
    // 열별 합계 초기화
    const sums = Array<number>(cols).fill(0)

    // 각 셀을 순회하며 숫자로 파싱 후 더하기
    data.forEach((row) => {
      row.forEach((cell, i) => {
        const num = typeof cell === 'number' ? cell : parseFloat(cell)
        if (!isNaN(num)) sums[i] += num
      })
    })

    // 합계 행 생성
    const sumRow: (string | number)[] = sums
    return [...data, sumRow]
  }, [data])
}

export default useSumRow
