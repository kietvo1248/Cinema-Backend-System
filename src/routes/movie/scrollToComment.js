/**
 * Cuộn mượt đến bình luận dựa vào ID. Hữu ích khi navigate đến trang khác và đợi DOM sẵn sàng.
 * @param {string} commentId - ID của comment, ví dụ: "123" sẽ cuộn đến phần tử có id="comment-123"
 * @param {number} [timeout=3000] - Thời gian tối đa chờ DOM render (ms)
 */
export const scrollToComment = (commentId, timeout = 3000) => {
    if (!commentId) return;

    const maxRetries = Math.floor(timeout / 100); // số lần thử mỗi 100ms
    let retries = 0;

    const interval = setInterval(() => {
        const el = document.getElementById(`comment-${commentId}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            clearInterval(interval);
        } else if (++retries >= maxRetries) {
            clearInterval(interval);
            console.warn(`⚠️ Không tìm thấy comment-${commentId} sau ${timeout}ms.`);
        }
    }, 100);
};
