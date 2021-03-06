/*
 * SonarQube
 * Copyright (C) 2009-2018 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import { searchMembers } from '../../api/organizations';
import { searchUsers } from '../../api/users';
import { Issue } from '../../app/types';
import { formatMeasure } from '../../helpers/measures';
import { get, save } from '../../helpers/storage';
import {
  queriesEqual,
  cleanQuery,
  parseAsBoolean,
  parseAsArray,
  parseAsString,
  serializeString,
  serializeStringArray,
  parseAsDate,
  serializeDateShort,
  RawQuery
} from '../../helpers/query';

export interface Query {
  assigned: boolean;
  assignees: string[];
  authors: string[];
  createdAfter: Date | undefined;
  createdAt: string;
  createdBefore: Date | undefined;
  createdInLast: string;
  cwe: string[];
  directories: string[];
  files: string[];
  issues: string[];
  languages: string[];
  modules: string[];
  owaspTop10: string[];
  projects: string[];
  resolutions: string[];
  resolved: boolean;
  rules: string[];
  sansTop25: string[];
  severities: string[];
  sinceLeakPeriod: boolean;
  sort: string;
  statuses: string[];
  tags: string[];
  types: string[];
}

export const STANDARDS = 'standards';

// allow sorting by CREATION_DATE only
const parseAsSort = (sort: string) => (sort === 'CREATION_DATE' ? 'CREATION_DATE' : '');
const ISSUES_DEFAULT = 'sonarqube.issues.default';

export function parseQuery(query: RawQuery): Query {
  return {
    assigned: parseAsBoolean(query.assigned),
    assignees: parseAsArray(query.assignees, parseAsString),
    authors: parseAsArray(query.authors, parseAsString),
    createdAfter: parseAsDate(query.createdAfter),
    createdAt: parseAsString(query.createdAt),
    createdBefore: parseAsDate(query.createdBefore),
    createdInLast: parseAsString(query.createdInLast),
    cwe: parseAsArray(query.cwe, parseAsString),
    directories: parseAsArray(query.directories, parseAsString),
    files: parseAsArray(query.fileUuids, parseAsString),
    issues: parseAsArray(query.issues, parseAsString),
    languages: parseAsArray(query.languages, parseAsString),
    modules: parseAsArray(query.moduleUuids, parseAsString),
    owaspTop10: parseAsArray(query.owaspTop10, parseAsString),
    projects: parseAsArray(query.projectUuids, parseAsString),
    resolutions: parseAsArray(query.resolutions, parseAsString),
    resolved: parseAsBoolean(query.resolved),
    rules: parseAsArray(query.rules, parseAsString),
    sansTop25: parseAsArray(query.sansTop25, parseAsString),
    severities: parseAsArray(query.severities, parseAsString),
    sinceLeakPeriod: parseAsBoolean(query.sinceLeakPeriod, false),
    sort: parseAsSort(query.s),
    statuses: parseAsArray(query.statuses, parseAsString),
    tags: parseAsArray(query.tags, parseAsString),
    types: parseAsArray(query.types, parseAsString)
  };
}

export function getOpen(query: RawQuery): string {
  return query.open;
}

export const areMyIssuesSelected = (query: RawQuery) => query.myIssues === 'true';

export function serializeQuery(query: Query): RawQuery {
  const filter = {
    assigned: query.assigned ? undefined : 'false',
    assignees: serializeStringArray(query.assignees),
    authors: serializeStringArray(query.authors),
    createdAfter: serializeDateShort(query.createdAfter),
    createdAt: serializeString(query.createdAt),
    createdBefore: serializeDateShort(query.createdBefore),
    createdInLast: serializeString(query.createdInLast),
    cwe: serializeStringArray(query.cwe),
    directories: serializeStringArray(query.directories),
    fileUuids: serializeStringArray(query.files),
    issues: serializeStringArray(query.issues),
    languages: serializeStringArray(query.languages),
    moduleUuids: serializeStringArray(query.modules),
    owaspTop10: serializeStringArray(query.owaspTop10),
    projectUuids: serializeStringArray(query.projects),
    resolutions: serializeStringArray(query.resolutions),
    resolved: query.resolved ? undefined : 'false',
    rules: serializeStringArray(query.rules),
    s: serializeString(query.sort),
    sansTop25: serializeStringArray(query.sansTop25),
    severities: serializeStringArray(query.severities),
    sinceLeakPeriod: query.sinceLeakPeriod ? 'true' : undefined,
    statuses: serializeStringArray(query.statuses),
    tags: serializeStringArray(query.tags),
    types: serializeStringArray(query.types)
  };
  return cleanQuery(filter);
}

export const areQueriesEqual = (a: RawQuery, b: RawQuery) =>
  queriesEqual(parseQuery(a), parseQuery(b));

export interface RawFacet {
  property: string;
  values: Array<{ val: string; count: number }>;
}

export interface Facet {
  [value: string]: number;
}

export function mapFacet(facet: string) {
  const propertyMapping: { [x: string]: string } = {
    files: 'fileUuids',
    modules: 'moduleUuids',
    projects: 'projectUuids'
  };
  return propertyMapping[facet] || facet;
}

export function parseFacets(facets: RawFacet[]) {
  // for readability purpose
  const propertyMapping: { [x: string]: string } = {
    fileUuids: 'files',
    moduleUuids: 'modules',
    projectUuids: 'projects'
  };

  const result: { [x: string]: Facet } = {};
  facets.forEach(facet => {
    const values: Facet = {};
    facet.values.forEach(value => {
      values[value.val] = value.count;
    });
    const finalProperty = propertyMapping[facet.property] || facet.property;
    result[finalProperty] = values;
  });
  return result;
}

export function formatFacetStat(stat: number | undefined) {
  return stat && formatMeasure(stat, 'SHORT_INT');
}

export interface ReferencedComponent {
  key: string;
  name: string;
  organization: string;
  path: string;
}

export interface ReferencedUser {
  avatar: string;
  name: string;
}

export interface ReferencedLanguage {
  name: string;
}

export const searchAssignees = (query: string, organization?: string) => {
  return organization
    ? searchMembers({ organization, ps: 50, q: query }).then(response =>
        response.users.map(user => ({
          avatar: user.avatar,
          label: user.name,
          value: user.login
        }))
      )
    : searchUsers({ q: query }).then(response =>
        response.users.map(user => ({
          // TODO this WS returns no avatar
          avatar: user.avatar,
          email: user.email,
          label: user.name,
          value: user.login
        }))
      );
};

const LOCALSTORAGE_MY = 'my';
const LOCALSTORAGE_ALL = 'all';

export const isMySet = () => {
  return get(ISSUES_DEFAULT) === LOCALSTORAGE_MY;
};

export const saveMyIssues = (myIssues: boolean) =>
  save(ISSUES_DEFAULT, myIssues ? LOCALSTORAGE_MY : LOCALSTORAGE_ALL);

export function getLocations(
  { flows, secondaryLocations }: Pick<Issue, 'flows' | 'secondaryLocations'>,
  selectedFlowIndex: number | undefined
) {
  if (selectedFlowIndex !== undefined) {
    return flows[selectedFlowIndex] || [];
  } else {
    return flows.length > 0 ? flows[0] : secondaryLocations;
  }
}

export function getSelectedLocation(
  issue: Pick<Issue, 'flows' | 'secondaryLocations'>,
  selectedFlowIndex: number | undefined,
  selectedLocationIndex: number | undefined
) {
  const locations = getLocations(issue, selectedFlowIndex);
  if (
    selectedLocationIndex !== undefined &&
    selectedLocationIndex >= 0 &&
    locations.length >= selectedLocationIndex
  ) {
    return locations[selectedLocationIndex];
  } else {
    return undefined;
  }
}

export function allLocationsEmpty(
  issue: Pick<Issue, 'flows' | 'secondaryLocations'>,
  selectedFlowIndex: number | undefined
) {
  return getLocations(issue, selectedFlowIndex).every(location => !location.msg);
}
