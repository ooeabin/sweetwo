// proposals 기능(제안, G-08). 밖으로 내보낼 것만 여기서 export.
export { G08Proposal } from './pages/g-08-proposal';
export { SplitPicker, type SplitPick } from './split-picker';
export { ProposalLines } from './proposal-lines';
export { copy as proposalCopy } from './copy';
export {
  openReceived,
  openSent,
  recalcPendingShares,
  refreshAfterChange,
  useApplyDue,
  useProposals,
} from './data';
export { describe as describeProposal, nameOf as proposerName, type Names } from './values';
