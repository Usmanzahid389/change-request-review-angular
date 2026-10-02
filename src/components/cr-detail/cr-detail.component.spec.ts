import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrDetailComponent } from './cr-detail.component';
import { SessionService } from '../../session/session.service';
import { CrApiService } from '../../api/cr-api.service';
import { users } from '../../api/fixtures';
import { ReqUser } from '../../models/cr.models';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(
	user: ReqUser,
	id: string,
	configure?: (api: CrApiService) => void,
): Promise<{ fixture: ComponentFixture<CrDetailComponent>; api: CrApiService }> {
	TestBed.configureTestingModule({
		imports: [CrDetailComponent],
		providers: [{ provide: SessionService, useValue: { user } }, CrApiService],
	});
	await TestBed.compileComponents();
	const api = TestBed.inject(CrApiService);
	configure?.(api);
	const fixture = TestBed.createComponent(CrDetailComponent);
	fixture.componentInstance.id = id;
	fixture.detectChanges();
	await flush();
	fixture.detectChanges();
	return { fixture, api };
}

describe('CrDetailComponent', () => {
	it('loads and renders the change request title', async () => {
		const { fixture } = await render(users.approver, 'CR-1');
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
	});

	it('disables Approve for a read-only viewer on a pending CR', async () => {
		const { fixture } = await render(users.viewer, 'CR-1'); // viewer: cr_r_o only; CR-1 is PENDING_APPROVAL
		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');
		expect(approveBtn.disabled).toBe(true);
	});

	it('hides Reject controls for a read-only viewer', async () => {
		const { fixture } = await render(users.viewer, 'CR-1');
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
	});

	it('enables Approve and Reject for an approver on a pending CR', async () => {
		const { fixture } = await render(users.approver, 'CR-1');
		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');
		const rejectBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__reject-btn');
		expect(approveBtn.disabled).toBe(false);
		expect(rejectBtn).not.toBeNull();
		expect(rejectBtn.disabled).toBe(false);
	});

	it('disables Approve on a non-pending CR even for an approver', async () => {
		const { fixture } = await render(users.approver, 'CR-2'); // APPLIED
		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');
		expect(approveBtn.disabled).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
	});

	it('renders totals, delta, and a quantity change in the diff', async () => {
		const { fixture } = await render(users.approver, 'CR-1');
		expect(fixture.nativeElement.querySelector('.cr-detail__delta').textContent).toContain('500');
		const changed = fixture.nativeElement.querySelector('.cr-diff__row[data-kind="changed"]');
		expect(changed).not.toBeNull();
		expect(changed.textContent).toContain('SKU-A');
	});

	it('renders the timeline chronologically (oldest first)', async () => {
		const { fixture } = await render(users.approver, 'CR-1');
		const actions = Array.from(fixture.nativeElement.querySelectorAll('.cr-timeline__action')).map(
			(el: Element) => el.textContent?.trim(),
		);
		expect(actions).toEqual(['CREATE', 'SUBMIT', 'SEND_FOR_APPROVAL']);
	});

	it('shows a reason error and does not reject without a reason', async () => {
		const { fixture, api } = await render(users.approver, 'CR-1');
		const rejectSpy = jest.spyOn(api, 'reject');
		fixture.nativeElement.querySelector('.cr-actions__reject-btn').click();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-actions__reason-error')).not.toBeNull();
		expect(rejectSpy).not.toHaveBeenCalled();
	});

	it('approves a pending CR and updates the rendered status', async () => {
		const { fixture } = await render(users.approver, 'CR-1');
		fixture.nativeElement.querySelector('.cr-actions__approve').click();
		await flush();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('APPROVED');
		expect(fixture.nativeElement.querySelector('.cr-actions__approve').disabled).toBe(true);
	});

	it('rejects with a reason and updates the rendered status', async () => {
		const { fixture } = await render(users.approver, 'CR-1');
		const reason: HTMLTextAreaElement = fixture.nativeElement.querySelector('.cr-actions__reason');
		reason.value = 'Pricing not justified';
		reason.dispatchEvent(new Event('input'));
		fixture.detectChanges();

		const rejectBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__reject-btn');
		expect(rejectBtn.disabled).toBe(false);
		rejectBtn.click();
		await flush();
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('REJECTED');
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
	});

	it('surfaces an action error without clearing the loaded CR when approve fails', async () => {
		const { fixture, api } = await render(users.approver, 'CR-1');
		api.failNext = true;
		fixture.nativeElement.querySelector('.cr-actions__approve').click();
		await flush();
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.cr-actions__error').textContent).toContain('Network error');
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('PENDING_APPROVAL');
		expect(fixture.nativeElement.querySelector('.cr-actions__approve').disabled).toBe(false);
	});

	it('disables action buttons while a slow approve is in flight', async () => {
		const { fixture, api } = await render(users.approver, 'CR-1');
		api.latencyMs = 30;
		const approvePromise = fixture.componentInstance.approve();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-actions__approve').disabled).toBe(true);
		await approvePromise;
		await flush();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('APPROVED');
	});

	it('shows the load error state when the CR cannot be fetched', async () => {
		const { fixture } = await render(users.approver, 'CR-1', (api) => {
			api.failNext = true;
		});
		expect(fixture.nativeElement.querySelector('.cr-detail__error')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-detail__header')).toBeNull();
	});
});
