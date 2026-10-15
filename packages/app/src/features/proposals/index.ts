// proposals 기능(제안, G-08). 밖으로 내보낼 것만 여기서 export.
export { G08Proposal } from './pages/g-08-proposal';
export { SplitPicker, type SplitPick } from './split-picker';
export { ProposalLines } from './proposal-lines';
export { ProposalInline } from './proposal-inline';
export { useProposalActions } from './actions';
export { copy as proposalCopy } from './copy';
export {
  openReceived,
  openSent,
  recalcPendingShares,
  refreshAfterChange,
  useApplyDue,
  useProposals,
} from './data';
export {
  arrivedText as proposalArrived,
  describe as describeProposal,
  itemObject as proposalObject,
  nameOf as proposerName,
  type GoalName,
  type Names,
} from './values';
