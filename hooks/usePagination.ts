import { useState, useEffect, RefObject } from 'react';

const HEADER_HEIGHT = 50; // 顶部标题栏高度
const FOOTER_HEIGHT = 0; // 底部翻页按钮高度（已移除）
const CONTENT_PADDING = 96; // 内容区域上下padding总和
const BOTTOM_SAFE_SPACE = 80; // 底部预留空间，防止最后一行被截断
const MOBILE_TOP_BAR_HEIGHT = 48; // 移动端顶部栏高度

export const usePagination = (
  paragraphs: string[],
  measureRef: RefObject<HTMLElement>
) => {
  const [pageRanges, setPageRanges] = useState<{ start: number; end: number }[]>([{ start: 0, end: 0 }]);

  // 根据实际内容高度动态计算分页
  useEffect(() => {
    const calculatePages = () => {
      if (!measureRef.current || paragraphs.length === 0) return;

      const windowHeight = window.innerHeight;
      const isMobile = window.innerWidth < 768; // md breakpoint
      const extraHeight = isMobile ? MOBILE_TOP_BAR_HEIGHT : 0;
      const availableHeight = windowHeight - HEADER_HEIGHT - FOOTER_HEIGHT - CONTENT_PADDING - BOTTOM_SAFE_SPACE - extraHeight;

      // 测量每个段落的实际高度
      const paragraphElements = measureRef.current.children;
      const ranges: { start: number; end: number }[] = [];
      let currentHeight = 0;
      let pageStart = 0;

      for (let i = 0; i < paragraphElements.length; i++) {
        const element = paragraphElements[i] as HTMLElement;
        const elementHeight = element.offsetHeight;

        // 如果加上当前段落会超过可用高度，且当前页已有内容，则开始新页
        if (currentHeight + elementHeight > availableHeight && i > pageStart) {
          ranges.push({ start: pageStart, end: i });
          pageStart = i;
          currentHeight = elementHeight;
        } else {
          currentHeight += elementHeight;
        }
      }

      // 添加最后一页
      if (pageStart < paragraphs.length) {
        ranges.push({ start: pageStart, end: paragraphs.length });
      }

      setPageRanges(ranges.length > 0 ? ranges : [{ start: 0, end: paragraphs.length }]);
    };

    // 需要等待测量容器渲染完成
    const timer = setTimeout(calculatePages, 100);

    // 监听窗口大小变化
    window.addEventListener('resize', calculatePages);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePages);
    };
  }, [paragraphs, measureRef]);

  return { pageRanges };
};
