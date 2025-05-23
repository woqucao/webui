import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialog } from '@angular/material/dialog';
import { SpectatorRouting } from '@ngneat/spectator';
import { mockProvider, createRoutingFactory } from '@ngneat/spectator/jest';
import { of, pipe } from 'rxjs';
import { mockApi, mockCall } from 'app/core/testing/utils/mock-api.utils';
import { mockAuth } from 'app/core/testing/utils/mock-auth.utils';
import { FormatDateTimePipe } from 'app/modules/dates/pipes/format-date-time/format-datetime.pipe';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { IxCheckboxHarness } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.harness';
import { LoaderService } from 'app/modules/loader/loader.service';
import { FileSizePipe } from 'app/modules/pipes/file-size/file-size.pipe';
import { ApiService } from 'app/modules/websocket/api.service';
import { SnapshotCloneDialog } from 'app/pages/datasets/modules/snapshots/snapshot-clone-dialog/snapshot-clone-dialog.component';
import { SnapshotDetailsRowComponent } from 'app/pages/datasets/modules/snapshots/snapshot-details-row/snapshot-details-row.component';
import { SnapshotRollbackDialog } from 'app/pages/datasets/modules/snapshots/snapshot-rollback-dialog/snapshot-rollback-dialog.component';
import { fakeZfsSnapshot } from 'app/pages/datasets/modules/snapshots/testing/snapshot-fake-datasource';

describe('SnapshotDetailsRowComponent', () => {
  let spectator: SpectatorRouting<SnapshotDetailsRowComponent>;
  let loader: HarnessLoader;
  let api: ApiService;

  const createComponent = createRoutingFactory({
    component: SnapshotDetailsRowComponent,
    imports: [
      ReactiveFormsModule,
      FileSizePipe,
      FormatDateTimePipe,
    ],
    providers: [
      mockAuth(),
      mockProvider(LoaderService, {
        withLoader: jest.fn(() => pipe()),
      }),
      mockProvider(DialogService, {
        confirm: jest.fn(() => of(true)),
      }),
      mockApi([
        mockCall('pool.snapshot.query', [fakeZfsSnapshot]),
        mockCall('pool.snapshot.hold'),
        mockCall('pool.snapshot.release'),
        mockCall('pool.snapshot.delete'),
      ]),
    ],
  });

  beforeEach(() => {
    spectator = createComponent({
      props: {
        snapshot: { ...fakeZfsSnapshot, selected: false },
      },
    });
    loader = TestbedHarnessEnvironment.loader(spectator.fixture);
    api = spectator.inject(ApiService);
  });

  it('renders details rows', () => {
    const rows = spectator.queryAll('.details-row');
    expect(rows).toHaveLength(4);

    expect(rows[0]).toHaveText('Used: 1.49 TiB');
    expect(rows[1]).toHaveText('Date created: 2021-10-18 19:51:54');
    expect(rows[2]).toHaveText('Referenced: 1.49 TiB');
    expect(rows[3]).toHaveText('Retention: Will be automatically destroyed at 2022-06-07 07:25:14 by periodic snapshot task');
  });

  it('should open clone dialog when `Clone To New Dataset` button click', async () => {
    const matDialog = spectator.inject(MatDialog);
    jest.spyOn(matDialog, 'open').mockImplementation();

    const cloneButton = await loader.getHarness(MatButtonHarness.with({ text: 'Clone To New Dataset' }));
    await cloneButton.click();

    expect(matDialog.open).toHaveBeenCalledWith(SnapshotCloneDialog, { data: fakeZfsSnapshot.name });
  });

  it('should open rollback dialog when `Rollback` button click', async () => {
    const matDialog = spectator.inject(MatDialog);
    jest.spyOn(matDialog, 'open').mockImplementation();

    const rollbackButton = await loader.getHarness(MatButtonHarness.with({ text: 'Rollback' }));
    await rollbackButton.click();

    expect(matDialog.open).toHaveBeenCalledWith(SnapshotRollbackDialog, { data: fakeZfsSnapshot.name });
  });

  it('should make websocket query when Hold is changed', async () => {
    const holdCheckbox = await loader.getHarness(IxCheckboxHarness.with({ label: 'Hold' }));
    expect(await holdCheckbox.getValue()).toBeTruthy();

    await holdCheckbox.toggle();
    expect(api.call).toHaveBeenCalledWith('pool.snapshot.release', [fakeZfsSnapshot.name]);
    expect(await holdCheckbox.getValue()).toBeFalsy();

    await holdCheckbox.toggle();
    expect(api.call).toHaveBeenCalledWith('pool.snapshot.hold', [fakeZfsSnapshot.name]);
  });

  it('should delete snapshot when `Delete` button click', async () => {
    const deleteButton = await loader.getHarness(MatButtonHarness.with({ text: 'Delete' }));
    await deleteButton.click();

    expect(spectator.inject(DialogService).confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete',
        message: `Delete snapshot ${fakeZfsSnapshot.name}?`,
      }),
    );
    expect(api.call).toHaveBeenCalledWith('pool.snapshot.delete', [fakeZfsSnapshot.name]);
  });
});
