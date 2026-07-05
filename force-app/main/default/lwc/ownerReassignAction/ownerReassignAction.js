import { LightningElement, api, track } from 'lwc';
import { CloseActionScreenEvent } from 'lightning/actions';
import { updateRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import searchOwners from '@salesforce/apex/MiradorOwnerLookupController.search';
import getRecentOwners from '@salesforce/apex/MiradorOwnerLookupController.getRecentOwners';

const DEBOUNCE_MS = 250;

/**
 * ScreenAction quick action: Salesforce renders this component inside the quick
 * action modal, so the component owns its own markup (search field, result list,
 * footer buttons). Searches users and queues in one combined field and reassigns
 * the record's OwnerId via Lightning Data Service.
 *
 * Generic over the object — it reassigns whatever recordId/objectApiName the
 * quick action injects. OwnerId accepts both a User id and a Queue (Group) id, so
 * a single updateRecord call covers both owner kinds; no Apex DML is needed.
 */
export default class OwnerReassignAction extends LightningElement {
    @api recordId;
    @api objectApiName;

    @track results = [];
    searchTerm = '';
    selected;
    loading = false;
    saving = false;
    errorMessage;

    _debounceTimer;

    connectedCallback() {
        // Prime the list with a default page so the modal isn't empty on open.
        this.runSearch('');
    }

    disconnectedCallback() {
        clearTimeout(this._debounceTimer);
    }

    get hasResults() {
        return this.results.length > 0;
    }

    get showEmpty() {
        return !this.loading && !this.hasResults;
    }

    get confirmDisabled() {
        return this.saving || !this.selected;
    }

    handleSearchChange(event) {
        this.searchTerm = event.target.value;
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
            this.runSearch(this.searchTerm);
        }, DEBOUNCE_MS);
    }

    async runSearch(term) {
        this.loading = true;
        this.errorMessage = undefined;
        try {
            const trimmed = (term || '').trim();
            // Empty query → default page of the user's recently viewed owners.
            const rows = trimmed
                ? await searchOwners({
                      searchTerm: trimmed,
                      includeUsers: true,
                      includeQueues: true
                  })
                : await getRecentOwners({
                      includeUsers: true,
                      includeQueues: true
                  });
            // Recompute the selected styling so the current selection survives
            // re-renders after a new search.
            this.results = rows.map((r) => ({
                ...r,
                selectedClass: this.rowClass(r.id === this.selected?.id)
            }));
        } catch (error) {
            this.errorMessage = this.reduceError(error);
            this.results = [];
        } finally {
            this.loading = false;
        }
    }

    handleSelect(event) {
        const id = event.currentTarget.dataset.id;
        const row = this.results.find((r) => r.id === id);
        if (!row) {
            return;
        }
        this.selected = row;
        this.results = this.results.map((r) => ({
            ...r,
            selectedClass: this.rowClass(r.id === id)
        }));
    }

    handleCancel() {
        this.dispatchEvent(new CloseActionScreenEvent());
    }

    async handleConfirm() {
        if (!this.selected) {
            return;
        }
        this.saving = true;
        this.errorMessage = undefined;
        try {
            await updateRecord({
                fields: {
                    Id: this.recordId,
                    OwnerId: this.selected.id
                }
            });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Owner actualitzat',
                    message: `Assignat a ${this.selected.label}`,
                    variant: 'success'
                })
            );
            this.dispatchEvent(new CloseActionScreenEvent());
        } catch (error) {
            this.errorMessage = this.reduceError(error);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'No s’ha pogut reassignar',
                    message: this.errorMessage,
                    variant: 'error'
                })
            );
        } finally {
            this.saving = false;
        }
    }

    rowClass(isSelected) {
        return isSelected
            ? 'slds-listbox__item owner-row owner-row_selected'
            : 'slds-listbox__item owner-row';
    }

    reduceError(error) {
        if (Array.isArray(error?.body)) {
            return error.body.map((e) => e.message).join(', ');
        }
        return error?.body?.message || error?.message || 'Error desconegut';
    }
}
