import React, { useEffect, useState } from 'react';
import {
  cellWidth,
  Table,
  TableBody,
  TableHeader,
  TableVariant,
  textCenter,
} from '@patternfly/react-table';
import {
  Badge,
  Button,
  ButtonVariant,
  Chip,
  ChipGroup,
  Pagination,
  Select,
  SelectGroup,
  SelectOption,
  SelectVariant,
  Text,
  TextContent,
  TextVariants,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  ToolbarItemVariant,
} from '@patternfly/react-core';
import displayUtils from '@services/displayUtils';
import { FilterIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';
import dataContainerService from '@services/dataContainerService';
import { CacheTypeBadge } from '@app/Common/CacheTypeBadge';
import { useApiAlert } from '@app/utils/useApiAlert';
import { DeleteCache } from '@app/Caches/DeleteCache';
import { IgnoreCache } from '@app/Caches/IgnoreCache';
import {
  IExtraData,
  IRowData,
} from '@patternfly/react-table/src/components/Table/Table';
import { TableEmptyState } from '@app/Common/TableEmptyState';
import { ComponentHealth } from '@services/utils';
import { fetchCaches } from '@app/services/cachesHook';

interface CacheAction {
  cacheName: string;
  action: '' | 'ignore' | 'undo' | 'delete';
}

const CacheTableDisplay = (props: {
  cmName: string;
  setCachesCount: (count: number) => void;
  isVisible: boolean;
}) => {
  const { addAlert } = useApiAlert();
  const { loading, caches, error, reload } = fetchCaches(props.cmName);
  const [filteredCaches, setFilteredCaches] = useState<CacheInfo[]>([]);
  const [cachesPagination, setCachesPagination] = useState({
    page: 1,
    perPage: 10,
  });
  const [rows, setRows] = useState<any[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [chipsCacheFeature, setChipsCacheFeature] = useState<string[]>([]);
  const [chipsCacheType, setChipsCacheType] = useState<string[]>([]);
  const [chipsCacheStatus, setChipsCacheStatus] = useState<string[]>([]);
  const [isFilterSelectExpanded, setIsFilterSelectExpanded] = useState<boolean>(
    false
  );
  const [cacheAction, setCacheAction] = useState<CacheAction>({
    cacheName: '',
    action: '',
  });

  // new caches or new filters
  useEffect(() => {
    if (loading) {
      return;
    }

    props.setCachesCount(caches.length);
    let newFilteredCaches: CacheInfo[] = caches;

    if (selectedFilters.length == 0) {
      // clear chips
      setChipsCacheStatus([]);
      setChipsCacheFeature([]);
      setChipsCacheType([]);
    } else {
      // From the select, extract each category
      let filterStatus = extract(selectedFilters, cacheStatus);
      let filterFeatures = extract(selectedFilters, cacheFeatures);
      let filterCacheType = extract(selectedFilters, cacheTypes);
      // Update chips
      setChipsCacheStatus(filterStatus);
      setChipsCacheFeature(filterFeatures);
      setChipsCacheType(filterCacheType);

      // Filter caches by status
      if (filterStatus.length > 0) {
        newFilteredCaches = newFilteredCaches.filter((cacheInfo) =>
          isCacheStatus(cacheInfo, filterStatus)
        );
      }

      // Filter caches by cache type
      if (filterCacheType.length > 0) {
        newFilteredCaches = newFilteredCaches.filter((cacheInfo) =>
          isCacheType(cacheInfo, filterCacheType)
        );
      }

      // Filter caches by features
      if (filterFeatures.length > 0) {
        newFilteredCaches = newFilteredCaches.filter((cacheInfo) =>
          hasFeatures(cacheInfo, filterFeatures)
        );
      }
    }

    // Set filtered caches
    setFilteredCaches(newFilteredCaches);
  }, [props.isVisible, loading, caches, selectedFilters]);

  // new filtered caches or new pagination upgrades rows
  useEffect(() => {
    updateRows();
  }, [filteredCaches, cachesPagination]);

  const columns = [
    { title: 'Name', transforms: [cellWidth(20), textCenter] },
    {
      title: 'Type',
      transforms: [cellWidth(20), textCenter],
      cellTransforms: [textCenter],
    },
    {
      title: 'Health',
      transforms: [cellWidth(20), textCenter],
      cellTransforms: [textCenter],
    },
    {
      title: 'Features',
      transforms: [textCenter],
      cellTransforms: [textCenter],
    },
    {
      // Will display 'ignored' if the cache is ignored
      title: '',
      transforms: [cellWidth(15), textCenter],
      cellTransforms: [textCenter],
    },
  ];

  const actionResolver = (rowData: IRowData, extraData: IExtraData) => {
    if (rowData.size == 0) {
      return [];
    }

    // @ts-ignore
    if (rowData.cells[0].isIgnored) {
      return [
        {
          title: 'Undo ignore',
          onClick: (event, rowId, rowData, extra) =>
            openIgnoreCacheModal(
              rowData.cells[0].cacheName,
              rowData.cells[0].isIgnored
            ),
        },
      ];
    }

    return [
      {
        title: 'Ignore',
        onClick: (event, rowId, rowData, extra) =>
          openIgnoreCacheModal(
            rowData.cells[0].cacheName,
            rowData.cells[0].isIgnored
          ),
      },
      {
        title: 'Delete',
        onClick: (event, rowId, rowData, extra) => {
          setCacheAction({
            cacheName: rowData.cells[0].cacheName,
            action: 'delete',
          });
        },
      },
    ];
  };

  const isCacheIgnored = (cacheInfo: CacheInfo): boolean => {
    return cacheInfo.status == 'Ignored';
  };

  const closeDeleteModal = (deleteDone: boolean) => {
    if (deleteDone) {
      setFilteredCaches(
        filteredCaches.filter(
          (cacheInfo) => cacheInfo.name !== cacheAction.cacheName
        )
      );
      reload();
    }
    setCacheAction({ cacheName: '', action: '' });
  };

  const closeIgnoreModal = (ignoreDone: boolean) => {
    if (ignoreDone) {
      reload();
    }
    setCacheAction({ cacheName: '', action: '' });
  };

  const openIgnoreCacheModal = (cacheName: string, ignored: boolean) => {
    setCacheAction({
      cacheName: cacheName,
      action: ignored ? 'undo' : 'ignore',
    });
  };

  const updateRows = () => {
    const initSlice = (cachesPagination.page - 1) * cachesPagination.perPage;
    const currentPageCaches = filteredCaches.slice(
      initSlice,
      initSlice + cachesPagination.perPage
    );

    let currentRows: {
      heightAuto: boolean;
      cells: (string | any)[];
      type: string;
      disableActions: boolean;
    }[];

    if (currentPageCaches.length == 0 || loading || error != '') {
      currentRows = [
        {
          heightAuto: true,
          type: 'empty',
          disableActions: true,
          cells: [
            {
              props: { colSpan: 9 },
              title: (
                <TableEmptyState
                  loading={loading}
                  error={error}
                  empty={'There are no caches'}
                />
              ),
            },
          ],
        },
      ];
    } else {
      currentRows = currentPageCaches.map((cacheInfo) => {
        return {
          heightAuto: true,
          type: '',
          disableActions: false,
          cells: [
            {
              cacheName: cacheInfo.name,
              isIgnored: isCacheIgnored(cacheInfo),
              title: displayCacheName(cacheInfo),
            },
            {
              title: <CacheTypeBadge cacheType={cacheInfo.type} small={true} />,
            },
            { title: displayHealth(cacheInfo.health) },
            { title: displayCacheFeatures(cacheInfo) },
            { title: displayIfIgnored(cacheInfo) },
          ],
        };
      });
    }
    setRows(currentRows);
  };

  const displayCacheFeatures = (cacheInfo: CacheInfo) => {
    return (
      <TextContent>
        <Text component={TextVariants.small}>
          {displayUtils.createFeaturesString(cacheInfo.features)}
        </Text>
      </TextContent>
    );
  };

  const displayIfIgnored = (cacheInfo: CacheInfo) => {
    if (!isCacheIgnored(cacheInfo)) {
      return '';
    }

    return (
      <Badge key={`ignore-${cacheInfo.name}`} isRead>
        {displayUtils.capitalize(cacheInfo.status)}
      </Badge>
    );
  };

  const displayCacheName = (cacheInfo: CacheInfo) => {
    if (isCacheIgnored(cacheInfo)) {
      return (
        <Button
          key={`detail-button-${cacheInfo.name}`}
          variant={ButtonVariant.link}
          isDisabled={true}
        >
          {cacheInfo.name}
        </Button>
      );
    }

    return (
      <Link
        key={cacheInfo.name}
        to={'/cache/' + encodeURIComponent(cacheInfo.name)}
      >
        <Button
          key={`detail-button-${cacheInfo.name}`}
          variant={ButtonVariant.link}
        >
          {cacheInfo.name}
        </Button>
      </Link>
    );
  };

  const displayHealth = (health: string) => {
    return (
      <TextContent>
        <Text
          component={TextVariants.p}
          style={{
            color: displayUtils.healthColor(ComponentHealth[health], false),
          }}
        >
          {displayUtils.healthLabel(ComponentHealth[health])}
        </Text>
      </TextContent>
    );
  };

  const cacheTypes = [
    'Local',
    'Replicated',
    'Distributed',
    'Invalidated',
    'Scattered',
  ];
  const cacheFeatures = [
    'Bounded',
    'Indexed',
    'Persistent',
    'Transactional',
    'Secured',
    'Backups',
  ];

  const cacheStatus = ['Ignored'];

  const extract = (actualSelection: string[], ref: string[]): string[] => {
    return actualSelection.filter((s) => ref.includes(s));
  };

  const isCacheStatus = (
    cacheInfo: CacheInfo,
    actualSelection: string[]
  ): boolean => {
    return actualSelection.includes(cacheInfo.status);
  };

  const isCacheType = (
    cacheInfo: CacheInfo,
    actualSelection: string[]
  ): boolean => {
    return actualSelection.includes(cacheInfo.type);
  };

  const hasFeatures = (
    cacheInfo: CacheInfo,
    actualSelection: string[]
  ): boolean => {
    if (
      actualSelection.includes('Transactional') &&
      cacheInfo.features.transactional
    ) {
      return true;
    }
    if (actualSelection.includes('Bounded') && cacheInfo.features.bounded) {
      return true;
    }

    if (actualSelection.includes('Indexed') && cacheInfo.features.indexed) {
      return true;
    }

    if (
      actualSelection.includes('Persistent') &&
      cacheInfo.features.persistent
    ) {
      return true;
    }

    if (actualSelection.includes('Secured') && cacheInfo.features.secured) {
      return true;
    }
    if (
      actualSelection.includes('Backups') &&
      cacheInfo.features.hasRemoteBackup
    ) {
      return true;
    }
    return false;
  };

  const onDeleteChip = (chip) => {
    let actualSelection = selectedFilters.filter((item) => item !== chip);
    setSelectedFilters(actualSelection);
  };

  const onSelectFilter = (event, selection) => {
    let actualSelection;

    if (selectedFilters.includes(selection)) {
      actualSelection = selectedFilters.filter((item) => item !== selection);
    } else {
      actualSelection = [...selectedFilters, selection];
    }
    setSelectedFilters(actualSelection);
  };

  const onDeleteAllFilters = () => {
    setChipsCacheFeature([]);
    setChipsCacheType([]);
    setChipsCacheStatus([]);
    setSelectedFilters([]);
    reload();
  };

  const buildCreateCacheButton = () => {
    return (
      <Link
        to={{
          pathname: '/container/' + props.cmName + '/caches/create',
          state: {
            cmName: props.cmName,
          },
        }}
      >
        <Button variant={'primary'}>Create Cache</Button>
      </Link>
    );
  };

  const buildViewConfigurationsButton = () => {
    return (
      <Link
        to={{
          pathname: '/container/' + props.cmName + '/configurations/',
          state: {
            cmName: props.cmName,
          },
        }}
      >
        <Button variant={'link'}>Configuration templates</Button>
      </Link>
    );
  };

  const buildFilter = () => {
    return (
      <ToolbarGroup variant="filter-group">
        <ToolbarItem style={{ width: 250 }}>
          <Select
            variant={SelectVariant.checkbox}
            aria-label="Filter"
            onToggle={setIsFilterSelectExpanded}
            onSelect={onSelectFilter}
            selections={selectedFilters}
            isOpen={isFilterSelectExpanded}
            toggleIcon={<FilterIcon />}
            maxHeight={200}
            placeholderText="Filter"
            isGrouped={true}
          >
            <SelectGroup label="Cache type" key="group1">
              <SelectOption key={0} value="Local" />
              <SelectOption key={1} value="Replicated" />
              <SelectOption key={2} value="Distributed" />
              <SelectOption key={3} value="Invalidated" />
              <SelectOption key={4} value="Scattered" />
            </SelectGroup>
            <SelectGroup label="Feature" key="group2">
              <SelectOption key={5} value="Bounded" />
              <SelectOption key={6} value="Indexed" />
              <SelectOption key={7} value="Persistent" />
              <SelectOption key={8} value="Transactional" />
              <SelectOption key={9} value="Secured" />
              <SelectOption key={10} value="Backups" />
              <SelectOption key={11} value="Ignored" />
            </SelectGroup>
          </Select>
        </ToolbarItem>
      </ToolbarGroup>
    );
  };

  const buildPagination = () => {
    return (
      <Pagination
        itemCount={filteredCaches.length}
        perPage={cachesPagination.perPage}
        page={cachesPagination.page}
        onSetPage={(_event, pageNumber) =>
          setCachesPagination({
            page: pageNumber,
            perPage: cachesPagination.perPage,
          })
        }
        widgetId="pagination-caches"
        onPerPageSelect={(_event, perPage) =>
          setCachesPagination({
            page: cachesPagination.page,
            perPage: perPage,
          })
        }
        isCompact
      />
    );
  };

  const displayClearAll = () => {
    if (chipsCacheFeature.length == 0 && chipsCacheType.length == 0) {
      return '';
    }

    return (
      <Button
        variant={ButtonVariant.link}
        isInline
        onClick={onDeleteAllFilters}
      >
        Clear all
      </Button>
    );
  };

  if (!props.isVisible) {
    return <span />;
  }

  return (
    <React.Fragment>
      <Toolbar id="cache-table-toolbar">
        <ToolbarContent>
          <ToolbarItem variant={ToolbarItemVariant['search-filter']}>
            {buildFilter()}
          </ToolbarItem>
          <ToolbarItem variant={ToolbarItemVariant.separator}></ToolbarItem>
          <ToolbarItem>{buildCreateCacheButton()}</ToolbarItem>
          <ToolbarItem>{buildViewConfigurationsButton()}</ToolbarItem>
          <ToolbarItem variant={ToolbarItemVariant.pagination}>
            {buildPagination()}
          </ToolbarItem>
        </ToolbarContent>
        <ToolbarContent>
          <ToolbarItem variant={ToolbarItemVariant['chip-group']}>
            <ChipGroup key="chips-types" categoryName="Cache Type">
              {chipsCacheType.map((chip) => (
                <Chip key={'chip-' + chip} onClick={() => onDeleteChip(chip)}>
                  {chip}
                </Chip>
              ))}
            </ChipGroup>
            <ChipGroup key="chips-features" categoryName="Features">
              {chipsCacheFeature.map((chip) => (
                <Chip key={'chip-' + chip} onClick={() => onDeleteChip(chip)}>
                  {chip}
                </Chip>
              ))}
            </ChipGroup>
            <ChipGroup key="chip-status" categoryName="Status">
              {chipsCacheStatus.map((chip) => (
                <Chip key={'chip-' + chip} onClick={() => onDeleteChip(chip)}>
                  {chip}
                </Chip>
              ))}
            </ChipGroup>
          </ToolbarItem>
          <ToolbarItem>{displayClearAll()}</ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      <Table
        aria-label="Caches"
        cells={columns}
        rows={rows}
        className={'caches-table'}
        actionResolver={actionResolver}
        variant={TableVariant.compact}
      >
        <TableHeader />
        <TableBody />
      </Table>
      <DeleteCache
        cacheName={cacheAction.cacheName}
        isModalOpen={cacheAction.action == 'delete'}
        closeModal={closeDeleteModal}
      />
      <IgnoreCache
        cmName={props.cmName}
        cacheName={cacheAction.cacheName}
        isModalOpen={
          cacheAction.action == 'ignore' || cacheAction.action == 'undo'
        }
        action={cacheAction.action}
        closeModal={closeIgnoreModal}
      />
    </React.Fragment>
  );
};

export { CacheTableDisplay };
