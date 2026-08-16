export const AFTER_SALE_COMMUNICATION_STATUS_LABELS = {
  APPLIED: '待商家处理',
  APPROVED: '等待用户寄回',
  RETURNING: '用户已寄回，待商家验收',
  REFUNDED: '退款已完成',
  REJECTED: '售后已拒绝',
  ESCALATED: '平台仲裁中',
};

const READ_ONLY_STATUSES = new Set(['REFUNDED', 'ESCALATED']);
const REPLYABLE_STATUSES = new Set(['APPLIED', 'APPROVED', 'RETURNING', 'REJECTED']);

export function getAfterSaleCommunicationMode(afterSaleOrStatus) {
  const status = typeof afterSaleOrStatus === 'string'
    ? afterSaleOrStatus
    : afterSaleOrStatus?.status || afterSaleOrStatus?.afterSaleStatus;
  const isReadOnly = READ_ONLY_STATUSES.has(status);
  const canSend = REPLYABLE_STATUSES.has(status);

  const merchantActionText = {
    APPLIED: '待商家审核售后申请',
    RETURNING: '用户已寄回，待商家验收',
  }[status] || '';

  return {
    status,
    canSend,
    isReadOnly,
    openMethod: isReadOnly ? 'GET_HISTORY' : 'GET_THEN_POST',
    displayText: AFTER_SALE_COMMUNICATION_STATUS_LABELS[status] || status || '售后状态未知',
    actionLabel: isReadOnly ? '查看沟通' : '回复用户',
    needsMerchantAction: Boolean(merchantActionText),
    merchantActionText,
  };
}
